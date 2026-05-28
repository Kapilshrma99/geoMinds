from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import ConflictReport, ExtractedPropertyData, PropertyMatch, UploadedDocument
from app.services.agents import generate_risk_report as synthesize_risk_report
from app.services.agents import render_report_pdf
from app.services.ai_service import ai_service
from app.services.document_ai import extract_text, infer_property_fields
from app.services.gis import detect_conflicts as run_conflict_detection
from app.services.gis import find_best_match
from app.services.mongodb_mcp import mongodb_mcp_service


def extract_document_entities(*, document: UploadedDocument) -> dict[str, Any]:
    """
    Tool contract for Google Cloud Agent Builder.

    Agent Builder can call this FastAPI-exposed action to turn an uploaded
    document into structured property entities before downstream GIS and risk
    tools execute.
    """

    raw_text = extract_text(document.storage_path)
    fallback = infer_property_fields(raw_text, document.filename)
    fields, _ = ai_service.extract_property_data(raw_text=raw_text, filename=document.filename)
    fields["chunks"] = (fields.get("chunks") or fallback.get("chunks") or [])[:8]
    return {
        "raw_text": raw_text,
        "fields": fields,
    }


def match_gis_parcel(*, db: Session, extracted: ExtractedPropertyData) -> PropertyMatch | None:
    """
    Tool contract for Google Cloud Agent Builder parcel validation.
    """

    return find_best_match(db, extracted)


def detect_conflicts(
    *,
    db: Session,
    extracted: ExtractedPropertyData,
    match: PropertyMatch | None,
) -> list[ConflictReport]:
    """
    Tool contract for Google Cloud Agent Builder conflict reasoning.
    """

    return run_conflict_detection(db, extracted, match)


def fetch_mongodb_context(*, property_payload: dict[str, Any]) -> dict[str, Any]:
    """
    Tool contract for Google Cloud Agent Builder partner context retrieval.

    The MongoDB MCP layer keeps prior high-risk cases that the orchestrator can
    use as precedent during comparisons and recommendations.
    """

    return mongodb_mcp_service.fetch_similar_high_risk_records(property_payload=property_payload)


def generate_risk_report(
    db: Session,
    extracted: ExtractedPropertyData,
    match: PropertyMatch | None,
    conflicts: list[ConflictReport],
    baseline: dict[str, Any] | None = None,
):
    """
    Tool contract for Google Cloud Agent Builder report synthesis.
    """

    return synthesize_risk_report(db, extracted, match, conflicts, baseline=baseline)


def generate_pdf_report(*, report) -> bytes:
    """
    Tool contract for Google Cloud Agent Builder artifact generation.
    """

    return render_report_pdf(report)
