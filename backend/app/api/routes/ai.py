import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.deps import get_current_user
from app.models import AIReport, AgentExecutionLog, ChatHistory, ConflictReport, ExtractedPropertyData, PropertyMatch, UploadedDocument, User
from app.schemas import AnalyzeResponse, ChatRequest, ChatResponse, ExtractedDataOut, ReportOut
from app.services.agent_logs import create_agent_log, persist_agent_logs, public_agent_logs
from app.services.agents import generate_risk_report
from app.services.ai_service import ai_service
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


@router.post("/analyze-document/{document_id}", response_model=AnalyzeResponse)
def analyze_document(document_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(UploadedDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    context = geomind_orchestrator.analyze_document(db=db, user_id=current_user.id, document=doc)
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


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    extracted = None
    report = None
    conflicts: list[ConflictReport] = []
    if payload.property_id:
        extracted = db.get(ExtractedPropertyData, payload.property_id)
        if extracted:
            report = (
                db.query(AIReport)
                .filter(AIReport.property_data_id == extracted.id)
                .order_by(AIReport.created_at.desc())
                .first()
            )
            conflicts = db.query(ConflictReport).filter(ConflictReport.property_data_id == extracted.id).all()
    retrieved_chunks = retrieve_relevant_chunks(db, question=payload.question, property_data_id=payload.property_id) if payload.property_id else []
    rag_context, rag_citations = summarize_retrieved_chunks(retrieved_chunks)
    citations = rag_citations or (extracted.chunks[:3] if extracted and extracted.chunks else []) or ["Land parcel registry", "Conflict analysis output"]
    parcel_context = conversational_gis_context(db, extracted)
    report_payload = None
    if report:
        report_payload = {
            "risk_score": report.risk_score,
            "risk_level": report.risk_level,
            "summary": report.summary,
            "recommendation": report.report_json.get("recommendation"),
            "reasoning": report.report_json.get("reasoning", []),
            "conflicts": [conflict.details for conflict in conflicts],
        }
    answer, agent_log = ai_service.answer_gis_query(
        question=payload.question,
        property_payload=_serialize_extracted(extracted),
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
            property_data_id=payload.property_id,
        )
        for item in agent_log
    ]
    persist_agent_logs(db, logs)
    return ChatResponse(answer=answer, citations=citations, agent_log=public_agent_logs(logs))


@router.post("/chat/stream")
def stream_chat(payload: ChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    extracted = db.get(ExtractedPropertyData, payload.property_id) if payload.property_id else None
    report = None
    conflicts: list[ConflictReport] = []
    if extracted:
        report = (
            db.query(AIReport)
            .filter(AIReport.property_data_id == extracted.id)
            .order_by(AIReport.created_at.desc())
            .first()
        )
        conflicts = db.query(ConflictReport).filter(ConflictReport.property_data_id == extracted.id).all()
    retrieved_chunks = retrieve_relevant_chunks(db, question=payload.question, property_data_id=payload.property_id) if payload.property_id else []
    rag_context, rag_citations = summarize_retrieved_chunks(retrieved_chunks)
    citations = rag_citations or (extracted.chunks[:3] if extracted and extracted.chunks else []) or ["Land parcel registry", "Conflict analysis output"]
    report_payload = None
    if report:
        report_payload = {
            "risk_score": report.risk_score,
            "risk_level": report.risk_level,
            "summary": report.summary,
            "recommendation": report.report_json.get("recommendation"),
            "reasoning": report.report_json.get("reasoning", []),
            "conflicts": [conflict.details for conflict in conflicts],
        }
    stream, log_entries = ai_service.stream_gis_query(
        question=payload.question,
        property_payload=_serialize_extracted(extracted),
        parcel_context=conversational_gis_context(db, extracted),
        report_payload=report_payload,
        retrieved_context=rag_context,
        citations=citations,
    )
    logs = [
        create_agent_log(
            agent_name=item["agent"],
            message=item["message"],
            run_type="chat_stream",
            user_id=current_user.id,
            property_data_id=payload.property_id,
        )
        for item in log_entries
    ]
    persist_agent_logs(db, logs)

    def event_stream():
        full_answer = ""
        yield f"data: {json.dumps({'type': 'meta', 'citations': citations, 'agent_log': public_agent_logs(logs)})}\n\n"
        for chunk in stream:
            full_answer += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'delta': chunk})}\n\n"
        db.add(ChatHistory(user_id=current_user.id, question=payload.question, answer=full_answer, citations=citations))
        db.commit()
        yield f"data: {json.dumps({'type': 'done', 'answer': full_answer, 'citations': citations})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/generate-report/{property_id}", response_model=ReportOut)
def generate_report(property_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    extracted = db.get(ExtractedPropertyData, property_id)
    if not extracted:
        raise HTTPException(status_code=404, detail="Property not found")
    match = db.query(PropertyMatch).filter(PropertyMatch.property_data_id == property_id).order_by(PropertyMatch.id.desc()).first()
    conflicts = db.query(ConflictReport).filter(ConflictReport.property_data_id == property_id).all()
    report = generate_risk_report(db, extracted, match, conflicts)
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
    query = db.query(AgentExecutionLog)
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
