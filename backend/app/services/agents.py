from __future__ import annotations

from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.models import AIReport, ChatHistory, ConflictReport, ExtractedPropertyData, PropertyMatch
from app.services.ai_service import ai_service


def build_agent_log(*steps: tuple[str, str]) -> list[dict[str, str]]:
    return [{"agent": agent, "message": message} for agent, message in steps]


def calculate_risk_baseline(
    extracted: ExtractedPropertyData,
    match: PropertyMatch | None,
    conflicts: list[ConflictReport],
) -> dict:
    score = 15
    reasons: list[str] = []
    signal_breakdown = {
        "duplicate_khasra": 0,
        "owner_mismatch": 0,
        "spatial_overlap": 0,
        "geometry_conflict": 0,
        "missing_parcel": 0,
        "area_mismatch": 0,
        "nearby_disputed_parcels": 0,
        "other": 0,
    }

    for conflict in conflicts:
        if conflict.severity == "high":
            score += 30
        elif conflict.severity == "medium":
            score += 15
        else:
            score += 3
        reasons.append(f"{conflict.conflict_type}: {conflict.details}")
        conflict_type = (conflict.conflict_type or "").lower()
        if "duplicate" in conflict_type or "khasra" in conflict_type:
            signal_breakdown["duplicate_khasra"] += 1
        elif "owner" in conflict_type:
            signal_breakdown["owner_mismatch"] += 1
        elif "overlap" in conflict_type:
            signal_breakdown["spatial_overlap"] += 1
        elif "geometry" in conflict_type or "boundary" in conflict_type:
            signal_breakdown["geometry_conflict"] += 1
        elif "missing" in conflict_type or "not found" in conflict_type:
            signal_breakdown["missing_parcel"] += 1
        elif "area" in conflict_type:
            signal_breakdown["area_mismatch"] += 1
        elif "nearby" in conflict_type or "disputed" in conflict_type:
            signal_breakdown["nearby_disputed_parcels"] += 1
        else:
            signal_breakdown["other"] += 1

    if match:
        score = max(score - int(match.match_score // 10), 0)

    score = min(score, 100)
    if score >= 70:
        level = "High"
    elif score >= 40:
        level = "Medium"
    else:
        level = "Low"

    return {
        "heuristic_score": score,
        "heuristic_level": level,
        "reasons": reasons,
        "signal_breakdown": signal_breakdown,
    }


def generate_risk_report(
    db: Session,
    extracted: ExtractedPropertyData,
    match: PropertyMatch | None,
    conflicts: list[ConflictReport],
    baseline: dict | None = None,
) -> AIReport:
    baseline = baseline or calculate_risk_baseline(extracted, match, conflicts)
    score = baseline["heuristic_score"]
    level = baseline["heuristic_level"]
    extracted_payload = {
        "owner_name": extracted.owner_name,
        "khasra_no": extracted.khasra_no,
        "village": extracted.village,
        "district": extracted.district,
        "area": extracted.area,
        "coordinates": extracted.coordinates,
        "document_date": extracted.document_date.isoformat() if extracted.document_date else None,
        "chunks": extracted.chunks or [],
    }
    match_payload = (
        {
            "parcel_id": match.parcel_id,
            "match_score": match.match_score,
            "match_reason": match.match_reason,
        }
        if match
        else None
    )
    conflicts_payload = [
        {
            "type": conflict.conflict_type,
            "severity": conflict.severity,
            "details": conflict.details,
            "metadata": conflict.conflict_metadata,
        }
        for conflict in conflicts
    ]
    generated, _ = ai_service.generate_report(
        extracted_payload=extracted_payload,
        match_payload=match_payload,
        conflicts_payload=conflicts_payload,
        heuristic_score=score,
        heuristic_level=level,
    )
    summary = generated["summary"]
    report_json = {
        "property_summary": extracted_payload,
        "gis_match_status": {
            "matched": bool(match),
            "parcel_id": match.parcel_id if match else None,
            "match_score": match.match_score if match else 0,
            "match_reason": match.match_reason if match else "No reliable cadastral match found.",
        },
        "conflicts": conflicts_payload,
        "executive_summary": generated.get("executive_summary", summary),
        "recommendation": generated["recommendation"],
        "recommended_actions": generated.get("recommended_actions", []),
        "citations": extracted.chunks or [],
        "reasoning": generated["reasoning"] or baseline["reasons"],
        "ownership_analysis": generated.get("ownership_analysis"),
        "boundary_analysis": generated.get("boundary_analysis"),
        "overlap_metrics": generated.get("overlap_metrics", {}),
        "evidence_summary": generated.get("evidence_summary", []),
        "nearby_disputed_parcels": generated.get("nearby_disputed_parcels", []),
        "baseline": baseline,
    }
    report = AIReport(
        property_data_id=extracted.id,
        risk_score=max(0, min(int(generated["risk_score"]), 100)),
        risk_level=generated["risk_level"],
        summary=summary,
        report_json=report_json,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def render_report_pdf(report: AIReport) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle("GeoMind AI Property Report")
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(42, 806, "GeoMind AI Property Intelligence Report")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(42, 790, f"Property Data ID: {report.property_data_id}")
    pdf.drawString(42, 776, f"Risk Score: {report.risk_score}/100")
    pdf.drawString(220, 776, f"Risk Level: {report.risk_level}")
    text = pdf.beginText(42, 748)
    text.setFont("Helvetica-Bold", 12)
    text.textLine("Executive Summary")
    text.setFont("Helvetica", 10)
    for line in [report.report_json.get("executive_summary") or report.summary, ""]:
        text.textLine(line[:118])
    text.setFont("Helvetica-Bold", 12)
    text.textLine("Reasoning")
    text.setFont("Helvetica", 10)
    for line in report.report_json.get("reasoning", [])[:5]:
        text.textLine(f"- {line[:114]}")
    text.textLine("")
    text.setFont("Helvetica-Bold", 12)
    text.textLine("Recommendations")
    text.setFont("Helvetica", 10)
    recommended_actions = report.report_json.get("recommended_actions") or [report.report_json.get("recommendation", "")]
    for line in recommended_actions[:4]:
        text.textLine(f"- {str(line)[:114]}")
    pdf.drawText(text)
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
