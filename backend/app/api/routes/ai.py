import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.deps import get_current_user, require_document_access, require_property_access
from app.models import AIReport, AgentExecutionLog, ChatHistory, ConflictReport, ExtractedPropertyData, PropertyMatch, UploadedDocument, User
from app.schemas import AnalyzeBatchRequest, AnalyzeBatchResponse, AnalyzeResponse, ChatRequest, ChatResponse, ExtractedDataOut, ReportOut
from app.services.agent_builder_tools import generate_risk_report
from app.services.agent_logs import create_agent_log, persist_agent_logs, public_agent_logs
from app.services.ai_service import ai_service
from app.services.mongodb_mcp import mongodb_mcp_service
from app.services.orchestration import geomind_orchestrator
from app.services.gis import conversational_gis_context
from app.services.rag import retrieve_relevant_chunks, summarize_retrieved_chunks

router = APIRouter()


def _iso(value):
    if isinstance(value, date):
        return value.isoformat()
    return value


def _serialize_extracted(extracted: ExtractedPropertyData | None) -> dict | None:
    if not extracted:
        return None
    return {
        "id": extracted.id,
        "document_id": extracted.document_id,
        "owner_name": extracted.owner_name,
        "khasra_no": extracted.khasra_no,
        "village": extracted.village,
        "district": extracted.district,
        "area": extracted.area,
        "coordinates": extracted.coordinates,
        "document_date": _iso(extracted.document_date),
        "chunks": extracted.chunks or [],
    }


def _serialize_report(report: AIReport | None, conflicts: list[ConflictReport]) -> dict | None:
    if not report:
        return None
    return {
        "property_data_id": report.property_data_id,
        "risk_score": report.risk_score,
        "risk_level": report.risk_level,
        "summary": report.summary,
        "recommendation": report.report_json.get("recommendation"),
        "reasoning": report.report_json.get("reasoning", []),
        "conflicts": [conflict.details for conflict in conflicts],
    }


def _resolve_chat_scope(payload: ChatRequest, current_user: User, db: Session) -> list[ExtractedPropertyData]:
    if payload.use_all_properties:
        query = db.query(ExtractedPropertyData).join(UploadedDocument, UploadedDocument.id == ExtractedPropertyData.document_id)
        if current_user.role != "admin":
            query = query.filter(UploadedDocument.user_id == current_user.id)
        return query.order_by(ExtractedPropertyData.created_at.desc()).limit(12).all()

    property_ids = payload.property_ids or ([] if payload.property_id is None else [payload.property_id])
    resolved: list[ExtractedPropertyData] = []
    seen: set[int] = set()
    for property_id in property_ids:
        if property_id in seen:
            continue
        resolved.append(require_property_access(current_user, db.get(ExtractedPropertyData, property_id), db))
        seen.add(property_id)
    return resolved


def _build_chat_context(
    *,
    extracted_items: list[ExtractedPropertyData],
    question: str,
    db: Session,
) -> tuple[dict | list[dict] | None, list[dict], dict | list[dict] | None, list[str], list[str]]:
    reports: list[dict] = []
    parcel_context: list[dict] = []
    for extracted in extracted_items:
        report = (
            db.query(AIReport)
            .filter(AIReport.property_data_id == extracted.id)
            .order_by(AIReport.created_at.desc())
            .first()
        )
        conflicts = db.query(ConflictReport).filter(ConflictReport.property_data_id == extracted.id).all()
        reports.append(_serialize_report(report, conflicts) or {"property_data_id": extracted.id, "conflicts": []})
        parcel_context.extend(conversational_gis_context(db, extracted))

    property_ids = [item.id for item in extracted_items]
    retrieved_chunks = retrieve_relevant_chunks(db, question=question, property_data_ids=property_ids, top_k=8) if property_ids else []
    rag_context, rag_citations = summarize_retrieved_chunks(retrieved_chunks)

    if len(extracted_items) == 1:
        extracted_payload = _serialize_extracted(extracted_items[0])
        report_payload = reports[0] if reports else None
        fallback_citations = (extracted_items[0].chunks[:3] if extracted_items[0].chunks else []) or ["Land parcel registry", "Conflict analysis output"]
        return extracted_payload, parcel_context, report_payload, rag_context, rag_citations or fallback_citations

    extracted_payloads = [_serialize_extracted(item) for item in extracted_items]
    citations = rag_citations or [f"{item.document.filename} | property {item.id}" for item in extracted_items[:6]]
    return extracted_payloads, parcel_context, reports, rag_context, citations or ["Land parcel registry", "Conflict analysis output"]


@router.post("/analyze-document/{document_id}", response_model=AnalyzeResponse)
def analyze_document(document_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # FastAPI exposes this analysis action as a tool surface that Google Cloud
    # Agent Builder can orchestrate in the hackathon demo.
    doc = db.get(UploadedDocument, document_id)
    doc = require_document_access(current_user, doc)
    context = geomind_orchestrator.analyze_document(db=db, user_id=current_user.id, document=doc)
    mongodb_mcp_service.sync_document(db=db, document_id=doc.id)
    extracted = context.state["extracted"]
    match = context.state.get("match")
    conflicts = context.state.get("conflicts", [])
    report = context.state["report"]
    return AnalyzeResponse(
        document=doc,
        extracted_data=ExtractedDataOut.model_validate(extracted),
        match=match,
        conflicts=conflicts,
        report=ReportOut.model_validate(report),
        agent_log=context.public_logs,
    )


@router.post("/analyze-batch", response_model=AnalyzeBatchResponse)
def analyze_batch(payload: AnalyzeBatchRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    analyses: list[AnalyzeResponse] = []
    seen: set[int] = set()

    for document_id in payload.document_ids:
        if document_id in seen:
            continue
        seen.add(document_id)
        doc = db.get(UploadedDocument, document_id)
        doc = require_document_access(current_user, doc)
        context = geomind_orchestrator.analyze_document(db=db, user_id=current_user.id, document=doc)
        mongodb_mcp_service.sync_document(db=db, document_id=doc.id)
        extracted = context.state["extracted"]
        match = context.state.get("match")
        conflicts = context.state.get("conflicts", [])
        report = context.state["report"]
        analyses.append(
            AnalyzeResponse(
                document=doc,
                extracted_data=ExtractedDataOut.model_validate(extracted),
                match=match,
                conflicts=conflicts,
                report=ReportOut.model_validate(report),
                agent_log=context.public_logs,
            )
        )

    if not analyses:
        raise HTTPException(status_code=400, detail="At least one document is required for batch analysis.")

    return AnalyzeBatchResponse(analyses=analyses, analyzed_count=len(analyses))


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    extracted_items = _resolve_chat_scope(payload, current_user, db)
    extracted_payload, parcel_context, report_payload, rag_context, citations = _build_chat_context(
        extracted_items=extracted_items,
        question=payload.question,
        db=db,
    )
    answer, agent_log = ai_service.answer_gis_query(
        question=payload.question,
        property_payload=extracted_payload,
        parcel_context=parcel_context,
        report_payload=report_payload,
        retrieved_context=rag_context,
        citations=citations,
    )
    db.add(ChatHistory(user_id=current_user.id, question=payload.question, answer=answer, citations=citations))
    db.commit()
    logs = [
        create_agent_log(
            agent_name=item["agent"],
            message=item["message"],
            run_type="chat",
            user_id=current_user.id,
            property_data_id=extracted_items[0].id if len(extracted_items) == 1 else None,
        )
        for item in agent_log
    ]
    persist_agent_logs(db, logs)
    return ChatResponse(answer=answer, citations=citations, agent_log=public_agent_logs(logs))


@router.post("/chat/stream")
def stream_chat(payload: ChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    question = payload.question
    extracted_items = _resolve_chat_scope(payload, current_user, db)
    extracted_payload, parcel_context, report_payload, rag_context, citations = _build_chat_context(
        extracted_items=extracted_items,
        question=payload.question,
        db=db,
    )
    stream, log_entries = ai_service.stream_gis_query(
        question=payload.question,
        property_payload=extracted_payload,
        parcel_context=parcel_context,
        report_payload=report_payload,
        retrieved_context=rag_context,
        citations=citations,
    )
    logs = [
        create_agent_log(
            agent_name=item["agent"],
            message=item["message"],
            run_type="chat_stream",
            user_id=user_id,
            property_data_id=extracted_items[0].id if len(extracted_items) == 1 else None,
        )
        for item in log_entries
    ]
    persist_agent_logs(db, logs)
    public_logs = public_agent_logs(logs)

    def event_stream():
        full_answer = ""
        yield f"data: {json.dumps({'type': 'meta', 'citations': citations, 'agent_log': public_logs})}\n\n"
        try:
            for chunk in stream:
                full_answer += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'delta': chunk})}\n\n"
        except Exception as exc:
            message = f"Streaming response interrupted: {exc.__class__.__name__}"
            full_answer += message
            yield f"data: {json.dumps({'type': 'chunk', 'delta': message})}\n\n"
        db.add(ChatHistory(user_id=user_id, question=question, answer=full_answer, citations=citations))
        db.commit()
        yield f"data: {json.dumps({'type': 'done', 'answer': full_answer, 'citations': citations})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/generate-report/{property_id}", response_model=ReportOut)
def generate_report(property_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    extracted = require_property_access(current_user, db.get(ExtractedPropertyData, property_id), db)
    match = db.query(PropertyMatch).filter(PropertyMatch.property_data_id == property_id).order_by(PropertyMatch.id.desc()).first()
    conflicts = db.query(ConflictReport).filter(ConflictReport.property_data_id == property_id).all()
    report = generate_risk_report(db, extracted, match, conflicts)
    mongodb_mcp_service.sync_document(db=db, document_id=extracted.document_id)
    logs = [
        create_agent_log(
            agent_name="Report Agent",
            message="Regenerated the property intelligence report through the centralized Gemini report pipeline.",
            run_type="report_generation",
            user_id=current_user.id,
            property_data_id=property_id,
            report_id=report.id,
        )
    ]
    persist_agent_logs(db, logs)
    return report


@router.get("/agent-logs")
def agent_logs(
    property_id: int | None = None,
    document_id: int | None = None,
    run_type: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if property_id is not None:
        require_property_access(current_user, db.get(ExtractedPropertyData, property_id), db)
    if document_id is not None:
        require_document_access(current_user, db.get(UploadedDocument, document_id))

    query = db.query(AgentExecutionLog)
    if current_user.role != "admin":
        owned_property = (
            db.query(ExtractedPropertyData.id)
            .join(UploadedDocument, UploadedDocument.id == ExtractedPropertyData.document_id)
            .filter(
                ExtractedPropertyData.id == AgentExecutionLog.property_data_id,
                UploadedDocument.user_id == current_user.id,
            )
            .correlate(AgentExecutionLog)
            .exists()
        )
        owned_document = (
            db.query(UploadedDocument.id)
            .filter(
                UploadedDocument.id == AgentExecutionLog.document_id,
                UploadedDocument.user_id == current_user.id,
            )
            .correlate(AgentExecutionLog)
            .exists()
        )
        query = query.filter(
            (AgentExecutionLog.user_id == current_user.id)
            | owned_property
            | owned_document
        )
    if property_id is not None:
        query = query.filter(AgentExecutionLog.property_data_id == property_id)
    if document_id is not None:
        query = query.filter(AgentExecutionLog.document_id == document_id)
    if run_type is not None:
        query = query.filter(AgentExecutionLog.run_type == run_type)
    rows = query.order_by(AgentExecutionLog.created_at.desc()).limit(50).all()
    return [
        {
            "id": row.id,
            "agent": row.agent_name,
            "message": row.message,
            "status": row.status,
            "run_type": row.run_type,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]
