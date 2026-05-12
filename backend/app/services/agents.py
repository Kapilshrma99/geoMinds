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

    for conflict in conflicts:
        if conflict.severity == "high":
            score += 30
        elif conflict.severity == "medium":
            score += 15
        else:
            score += 3
        reasons.append(f"{conflict.conflict_type}: {conflict.details}")

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
        },
        "conflicts": conflicts_payload,
        "recommendation": generated["recommendation"],
        "citations": extracted.chunks or [],
        "reasoning": generated["reasoning"] or baseline["reasons"],
        "ownership_analysis": generated.get("ownership_analysis"),
        "boundary_analysis": generated.get("boundary_analysis"),
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
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(48, 800, "GeoMind AI Property Intelligence Report")
    pdf.setFont("Helvetica", 11)
    pdf.drawString(48, 775, f"Risk Score: {report.risk_score}")
    pdf.drawString(48, 760, f"Risk Level: {report.risk_level}")
    text = pdf.beginText(48, 730)
    for line in [report.summary] + report.report_json.get("reasoning", []):
        text.textLine(line[:110])
    pdf.drawText(text)
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
