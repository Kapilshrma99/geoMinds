import json

from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from app.db.database import get_db
from app.deps import get_current_user
from app.models import AIReport, AgentExecutionLog, ConflictReport, ExtractedPropertyData, PropertyMatch, UploadedDocument, User
from app.services.geoserver import geoserver_layer_urls
from app.services.execution_stream import drain_execution_event, subscribe_execution_events, unsubscribe_execution_events

router = APIRouter()


@router.get("/summary")
def summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        counts = db.execute(
            text(
                """
                SELECT
                  (SELECT COUNT(*) FROM uploaded_documents) AS total_uploaded_properties,
                  (SELECT COUNT(*) FROM property_matches) AS total_matched_parcels,
                  (SELECT COUNT(*) FROM conflict_reports WHERE severity IN ('high', 'medium')) AS conflict_count,
                  (SELECT COUNT(*) FROM ai_reports WHERE risk_level = 'High') AS high_risk_properties,
                  (SELECT COUNT(*) FROM reference_layers WHERE is_active = true) AS active_reference_layers
                """
            )
        ).mappings().first()
        recent_reports = db.execute(
            text(
                """
                SELECT id, property_data_id, risk_score, risk_level, summary, created_at
                FROM ai_reports
                ORDER BY created_at DESC
                LIMIT 5
                """
            )
        ).mappings().all()
        recent_agent_activity = db.query(AgentExecutionLog).order_by(AgentExecutionLog.created_at.desc()).limit(12).all()
    else:
        user_documents = db.query(UploadedDocument.id).filter(UploadedDocument.user_id == current_user.id).subquery()
        user_properties = (
            db.query(ExtractedPropertyData.id)
            .join(UploadedDocument, UploadedDocument.id == ExtractedPropertyData.document_id)
            .filter(UploadedDocument.user_id == current_user.id)
            .subquery()
        )
        counts = {
            "total_uploaded_properties": db.query(UploadedDocument).filter(UploadedDocument.user_id == current_user.id).count(),
            "total_matched_parcels": db.query(PropertyMatch).filter(PropertyMatch.property_data_id.in_(user_properties)).count(),
            "conflict_count": (
                db.query(ConflictReport)
                .filter(ConflictReport.property_data_id.in_(user_properties), ConflictReport.severity.in_(("high", "medium")))
                .count()
            ),
            "high_risk_properties": (
                db.query(AIReport)
                .filter(AIReport.property_data_id.in_(user_properties), AIReport.risk_level == "High")
                .count()
            ),
            "active_reference_layers": db.execute(
                text("SELECT COUNT(*) FROM reference_layers WHERE is_active = true")
            ).scalar_one(),
        }
        recent_reports = (
            db.query(AIReport.id, AIReport.property_data_id, AIReport.risk_score, AIReport.risk_level, AIReport.summary, AIReport.created_at)
            .filter(AIReport.property_data_id.in_(user_properties))
            .order_by(AIReport.created_at.desc())
            .limit(5)
            .all()
        )
        recent_agent_activity = (
            db.query(AgentExecutionLog)
            .filter(
                (AgentExecutionLog.user_id == current_user.id)
                | (AgentExecutionLog.document_id.in_(user_documents))
                | (AgentExecutionLog.property_data_id.in_(user_properties))
            )
            .order_by(AgentExecutionLog.created_at.desc())
            .limit(12)
            .all()
        )
    return {
        **dict(counts or {}),
        "recent_analysis_reports": [dict(getattr(row, "_mapping", row)) for row in recent_reports],
        "recent_agent_activity": [
            {
                "id": row.id,
                "agent": row.agent_name,
                "message": row.message,
                "status": row.status,
                "run_type": row.run_type,
                "created_at": row.created_at.isoformat(),
            }
            for row in recent_agent_activity
        ],
        "map_preview": geoserver_layer_urls(),
        "user_role": current_user.role,
    }


@router.get("/agent-feed")
def agent_feed(current_user: User = Depends(get_current_user)):
    queue = subscribe_execution_events()

    def event_stream():
        try:
            while True:
                event = drain_execution_event(queue, timeout=15.0)
                if event is None:
                    yield ": keep-alive\n\n"
                    continue
                if current_user.role != "admin" and event.get("user_id") != current_user.id:
                    continue
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            unsubscribe_execution_events(queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
