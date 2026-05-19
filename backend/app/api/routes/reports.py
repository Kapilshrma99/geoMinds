from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.deps import get_current_user, require_report_access
from app.models import AIReport, ExtractedPropertyData, UploadedDocument, User
from app.schemas import ReportOut
from app.services.agents import render_report_pdf

router = APIRouter()


@router.get("", response_model=list[ReportOut])
def list_reports(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(AIReport)
    if current_user.role != "admin":
        query = (
            query.join(ExtractedPropertyData, ExtractedPropertyData.id == AIReport.property_data_id)
            .join(UploadedDocument, UploadedDocument.id == ExtractedPropertyData.document_id)
            .filter(UploadedDocument.user_id == current_user.id)
        )
    return query.order_by(AIReport.created_at.desc()).all()


@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.get(AIReport, report_id)
    return require_report_access(current_user, report, db)


@router.get("/{report_id}/download")
def download_report(report_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.get(AIReport, report_id)
    report = require_report_access(current_user, report, db)
    pdf = render_report_pdf(report)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="geomind-report-{report_id}.pdf"'},
    )
