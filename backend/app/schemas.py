from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "user"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    visible_pages: list[str] = []

    class Config:
        from_attributes = True


class ReferenceLayerOut(BaseModel):
    id: int
    name: str
    description: str | None
    source_filename: str | None
    feature_count: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LayerImportResponse(BaseModel):
    layer: ReferenceLayerOut
    imported_parcels: int
    analyzed_against: str


class PageAccessRuleUpdate(BaseModel):
    page_key: str
    role: str
    can_view: bool


class PageAccessMatrixRow(BaseModel):
    page_key: str
    label: str
    user: bool
    analyst: bool
    admin: bool


class DocumentOut(BaseModel):
    id: int
    filename: str
    file_type: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentBatchOut(BaseModel):
    documents: list[DocumentOut]
    uploaded_count: int


class ExtractedDataOut(BaseModel):
    id: int
    document_id: int
    owner_name: str | None
    khasra_no: str | None
    village: str | None
    district: str | None
    area: float | None
    coordinates: dict[str, Any] | None
    document_date: date | None
    chunks: list[str] | None

    class Config:
        from_attributes = True


class ParcelOut(BaseModel):
    id: int
    khasra_no: str
    owner_name: str
    village: str
    district: str
    area: float
    risk_hint: str | None
    geojson: dict[str, Any] | None = None


class ConflictOut(BaseModel):
    id: int
    conflict_type: str
    severity: str
    details: str
    metadata: dict[str, Any] | None = Field(default=None, validation_alias="conflict_metadata")

    class Config:
        from_attributes = True


class MatchOut(BaseModel):
    id: int
    property_data_id: int
    parcel_id: int
    match_score: float
    match_reason: str

    class Config:
        from_attributes = True


class ReportOut(BaseModel):
    id: int
    property_data_id: int
    risk_score: int
    risk_level: str
    summary: str
    report_json: dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    question: str
    property_id: int | None = None
    property_ids: list[int] | None = None
    use_all_properties: bool = False


class ChatResponse(BaseModel):
    answer: str
    citations: list[str]
    agent_log: list[dict[str, Any]]


class AnalyzeResponse(BaseModel):
    document: DocumentOut
    extracted_data: ExtractedDataOut
    match: MatchOut | None
    conflicts: list[ConflictOut]
    report: ReportOut
    agent_log: list[dict[str, Any]]


class AnalyzeBatchRequest(BaseModel):
    document_ids: list[int] = Field(min_length=1)


class AnalyzeBatchResponse(BaseModel):
    analyses: list[AnalyzeResponse]
    analyzed_count: int


class MCPStatusOut(BaseModel):
    enabled: bool
    connected: bool
    reason: str | None = None


class MCPSyncResponse(BaseModel):
    synced: bool
    status: MCPStatusOut
    record: dict[str, Any]


class MCPHighRiskRecordsResponse(BaseModel):
    status: MCPStatusOut
    records: list[dict[str, Any]]


class MCPComparisonResponse(BaseModel):
    mongodb_status: MCPStatusOut
    current_property: dict[str, Any]
    similar_records: list[dict[str, Any]]
    comparison: dict[str, Any]


class StreamEvent(BaseModel):
    type: str
    delta: str | None = None
    answer: str | None = None
    citations: list[str] | None = None
    agent_log: list[dict[str, Any]] | None = None


Token.model_rebuild()
