from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.deps import get_current_user, require_document_access, require_property_access
from app.models import ExtractedPropertyData, UploadedDocument, User
from app.schemas import MCPComparisonResponse, MCPHighRiskRecordsResponse, MCPSyncResponse
from app.services.mongodb_mcp import mongodb_mcp_service

router = APIRouter()


@router.post("/sync-document/{document_id}", response_model=MCPSyncResponse)
def sync_document_to_mcp(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = require_document_access(current_user, db.get(UploadedDocument, document_id))
    result = mongodb_mcp_service.sync_document(db=db, document_id=doc.id)
    return MCPSyncResponse.model_validate(result)


@router.get("/high-risk-records", response_model=MCPHighRiskRecordsResponse)
def list_high_risk_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = current_user
    _ = db
    result = mongodb_mcp_service.get_high_risk_records()
    return MCPHighRiskRecordsResponse.model_validate(result)


@router.post("/compare-property/{property_id}", response_model=MCPComparisonResponse)
def compare_property_with_high_risk_records(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    property_data = require_property_access(current_user, db.get(ExtractedPropertyData, property_id), db)
    result = mongodb_mcp_service.compare_property(db=db, property_id=property_data.id)
    return MCPComparisonResponse.model_validate(result)
