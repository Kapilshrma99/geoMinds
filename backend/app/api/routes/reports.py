from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.deps import get_current_user
from app.models import AIReport, User
from app.schemas import ReportOut
from app.services.agents import render_report_pdf

router = APIRouter()


@router.get("", response_model=list[ReportOut])
def list_reports(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(AIReport).order_by(AIReport.created_at.desc()).all()


@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.get(AIReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/{report_id}/download")
def download_report(report_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.get(AIReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    pdf = render_report_pdf(report)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="geomind-report-{report_id}.pdf"'},
    )
