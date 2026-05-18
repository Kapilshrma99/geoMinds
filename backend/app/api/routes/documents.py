from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.deps import get_current_user, require_document_access
from app.models import UploadedDocument, User
from app.schemas import DocumentOut

router = APIRouter()


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename).suffix or ".bin"
    unique_name = f"{uuid4().hex}{suffix}"
    target = upload_dir / unique_name
    content = await file.read()
    target.write_bytes(content)

    doc = UploadedDocument(
        user_id=current_user.id,
        filename=file.filename,
        file_type=file.content_type or "application/octet-stream",
        storage_path=str(target),
        status="uploaded",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("", response_model=list[DocumentOut])
def list_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(UploadedDocument)
    if current_user.role != "admin":
        query = query.filter(UploadedDocument.user_id == current_user.id)
    return query.order_by(UploadedDocument.created_at.desc()).all()


@router.get("/{document_id}")
def get_document(document_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(UploadedDocument, document_id)
    return require_document_access(current_user, doc)
