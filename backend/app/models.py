from datetime import datetime

from geoalchemy2 import Geometry
from pgvector.sqlalchemy import VECTOR
from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(30), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(50))
    storage_path: Mapped[str] = mapped_column(String(255))
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="uploaded")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class ExtractedPropertyData(Base):
    __tablename__ = "extracted_property_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("uploaded_documents.id"), unique=True)
    owner_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    khasra_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    village: Mapped[str | None] = mapped_column(String(255), nullable=True)
    district: Mapped[str | None] = mapped_column(String(255), nullable=True)
    area: Mapped[float | None] = mapped_column(Float, nullable=True)
    coordinates: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    document_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    chunks: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    document = relationship("UploadedDocument")


class LandParcel(Base):
    __tablename__ = "land_parcels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    khasra_no: Mapped[str] = mapped_column(String(100), index=True)
    owner_name: Mapped[str] = mapped_column(String(255))
    village: Mapped[str] = mapped_column(String(255), index=True)
    district: Mapped[str] = mapped_column(String(255), index=True)
    area: Mapped[float] = mapped_column(Float)
    geom: Mapped[str | None] = mapped_column(Geometry("MULTIPOLYGON", srid=4326), nullable=True)
    risk_hint: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PropertyMatch(Base):
    __tablename__ = "property_matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    property_data_id: Mapped[int] = mapped_column(ForeignKey("extracted_property_data.id"))
    parcel_id: Mapped[int] = mapped_column(ForeignKey("land_parcels.id"))
    match_score: Mapped[float] = mapped_column(Float)
    match_reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ConflictReport(Base):
    __tablename__ = "conflict_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    property_data_id: Mapped[int] = mapped_column(ForeignKey("extracted_property_data.id"))
    parcel_id: Mapped[int | None] = mapped_column(ForeignKey("land_parcels.id"), nullable=True)
    conflict_type: Mapped[str] = mapped_column(String(120))
    severity: Mapped[str] = mapped_column(String(20))
    details: Mapped[str] = mapped_column(Text)
    conflict_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AIReport(Base):
    __tablename__ = "ai_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    property_data_id: Mapped[int] = mapped_column(ForeignKey("extracted_property_data.id"))
    risk_score: Mapped[int] = mapped_column(Integer)
    risk_level: Mapped[str] = mapped_column(String(20))
    summary: Mapped[str] = mapped_column(Text)
    report_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    citations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AgentExecutionLog(Base):
    __tablename__ = "agent_execution_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("uploaded_documents.id"), nullable=True)
    property_data_id: Mapped[int | None] = mapped_column(ForeignKey("extracted_property_data.id"), nullable=True)
    report_id: Mapped[int | None] = mapped_column(ForeignKey("ai_reports.id"), nullable=True)
    run_type: Mapped[str] = mapped_column(String(50))
    agent_name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(30), default="completed")
    message: Mapped[str] = mapped_column(Text)
    log_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        Index(
            "ix_document_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("uploaded_documents.id"), index=True)
    property_data_id: Mapped[int | None] = mapped_column(ForeignKey("extracted_property_data.id"), nullable=True, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    citation_label: Mapped[str] = mapped_column(String(255))
    embedding: Mapped[list[float] | None] = mapped_column(VECTOR(settings.embedding_dimensions), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
