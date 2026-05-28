from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import AIReport, AgentExecutionLog, ConflictReport, ExtractedPropertyData, PropertyMatch, UploadedDocument
from app.services.ai_service import ai_service

try:
    from pymongo import DESCENDING, MongoClient
except Exception:  # pragma: no cover
    DESCENDING = -1
    MongoClient = None


def _iso(value: Any) -> Any:
    if isinstance(value, date):
        return value.isoformat()
    return value


@dataclass
class MongoMCPStatus:
    enabled: bool
    connected: bool
    reason: str | None = None


class MongoDBMCPService:
    """
    Partner integration layer for the hackathon's MongoDB MCP requirement.

    In production, Google Cloud Agent Builder would call FastAPI tools that in
    turn read and write precedent data through this MongoDB-backed context
    service. When MongoDB MCP is not configured, the service degrades
    gracefully so the existing GeoMind workflow stays operational.
    """

    collection_name = "agent_memory_records"

    def __init__(self) -> None:
        self._client = None

    def _is_placeholder(self, value: str | None) -> bool:
        if not value:
            return True
        normalized = value.strip().lower()
        return normalized in {"changeme", "change-me", "your-mongodb-uri"}

    def status(self) -> MongoMCPStatus:
        if not settings.mongodb_mcp_enabled:
            return MongoMCPStatus(enabled=False, connected=False, reason="MongoDB MCP disabled")
        if MongoClient is None:
            return MongoMCPStatus(enabled=True, connected=False, reason="pymongo not installed")
        if self._is_placeholder(settings.mongodb_uri) or self._is_placeholder(settings.mongodb_database):
            return MongoMCPStatus(enabled=True, connected=False, reason="MongoDB MCP not configured")
        return MongoMCPStatus(enabled=True, connected=True)

    @property
    def collection(self):
        status = self.status()
        if not status.connected:
            return None
        if self._client is None:
            self._client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=1500)
        return self._client[settings.mongodb_database][self.collection_name]

    @staticmethod
    def _serialize_document(doc: UploadedDocument) -> dict[str, Any]:
        return {
            "id": doc.id,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "status": doc.status,
            "created_at": _iso(doc.created_at),
        }

    @staticmethod
    def _serialize_extracted(extracted: ExtractedPropertyData | None) -> dict[str, Any] | None:
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

    @staticmethod
    def _serialize_match(match: PropertyMatch | None) -> dict[str, Any] | None:
        if not match:
            return None
        return {
            "parcel_id": match.parcel_id,
            "match_score": match.match_score,
            "match_reason": match.match_reason,
            "created_at": _iso(match.created_at),
        }

    @staticmethod
    def _serialize_conflicts(conflicts: list[ConflictReport]) -> list[dict[str, Any]]:
        return [
            {
                "id": item.id,
                "type": item.conflict_type,
                "severity": item.severity,
                "details": item.details,
                "metadata": item.conflict_metadata,
                "created_at": _iso(item.created_at),
            }
            for item in conflicts
        ]

    @staticmethod
    def _serialize_report(report: AIReport | None) -> dict[str, Any] | None:
        if not report:
            return None
        return {
            "id": report.id,
            "property_data_id": report.property_data_id,
            "risk_score": report.risk_score,
            "risk_level": report.risk_level,
            "summary": report.summary,
            "report_json": report.report_json,
            "created_at": _iso(report.created_at),
        }

    @staticmethod
    def _serialize_agent_logs(logs: list[AgentExecutionLog]) -> list[dict[str, Any]]:
        return [
            {
                "id": log.id,
                "agent_name": log.agent_name,
                "status": log.status,
                "message": log.message,
                "run_type": log.run_type,
                "metadata": log.log_metadata,
                "created_at": _iso(log.created_at),
            }
            for log in logs
        ]

    def sync_document(self, *, db: Session, document_id: int) -> dict[str, Any]:
        doc = db.get(UploadedDocument, document_id)
        if not doc:
            raise ValueError("Document not found")

        extracted = (
            db.query(ExtractedPropertyData)
            .filter(ExtractedPropertyData.document_id == document_id)
            .order_by(ExtractedPropertyData.id.desc())
            .first()
        )
        report = None
        match = None
        conflicts: list[ConflictReport] = []
        logs: list[AgentExecutionLog] = []

        if extracted:
            report = (
                db.query(AIReport)
                .filter(AIReport.property_data_id == extracted.id)
                .order_by(AIReport.created_at.desc())
                .first()
            )
            match = (
                db.query(PropertyMatch)
                .filter(PropertyMatch.property_data_id == extracted.id)
                .order_by(PropertyMatch.created_at.desc())
                .first()
            )
            conflicts = db.query(ConflictReport).filter(ConflictReport.property_data_id == extracted.id).all()
            logs = (
                db.query(AgentExecutionLog)
                .filter(AgentExecutionLog.document_id == document_id)
                .order_by(AgentExecutionLog.created_at.desc())
                .limit(30)
                .all()
            )

        payload = {
            "document_id": document_id,
            "document": self._serialize_document(doc),
            "extracted_entities": self._serialize_extracted(extracted),
            "gis_match": self._serialize_match(match),
            "risk_report": self._serialize_report(report),
            "conflicts": self._serialize_conflicts(conflicts),
            "agent_execution_summary": self._serialize_agent_logs(logs),
            "record_type": "property_case",
            "synced_at": datetime.utcnow().isoformat(),
        }

        status = self.status()
        if not status.connected or self.collection is None:
            return {
                "synced": False,
                "status": status.__dict__,
                "record": payload,
            }

        risk_score = (payload["risk_report"] or {}).get("risk_score", 0)
        risk_level = (payload["risk_report"] or {}).get("risk_level", "Unknown")
        collection_payload = {
            **payload,
            "search_tokens": [
                value
                for value in [
                    (payload["extracted_entities"] or {}).get("khasra_no"),
                    (payload["extracted_entities"] or {}).get("owner_name"),
                    (payload["extracted_entities"] or {}).get("village"),
                    (payload["extracted_entities"] or {}).get("district"),
                ]
                if value
            ],
            "is_high_risk": risk_score >= 70 or str(risk_level).lower() == "high",
        }
        try:
            self.collection.update_one({"document_id": document_id}, {"$set": collection_payload}, upsert=True)
        except Exception as exc:
            return {
                "synced": False,
                "status": {
                    "enabled": status.enabled,
                    "connected": False,
                    "reason": f"MongoDB MCP write failed: {exc.__class__.__name__}",
                },
                "record": payload,
            }
        return {
            "synced": True,
            "status": status.__dict__,
            "record": payload,
        }

    def get_high_risk_records(self, *, limit: int = 10) -> dict[str, Any]:
        status = self.status()
        if not status.connected or self.collection is None:
            return {
                "status": status.__dict__,
                "records": [],
            }
        try:
            records = list(
                self.collection.find(
                    {"is_high_risk": True},
                    {"_id": 0},
                ).sort("risk_report.risk_score", DESCENDING).limit(limit)
            )
        except Exception as exc:
            return {
                "status": {
                    "enabled": status.enabled,
                    "connected": False,
                    "reason": f"MongoDB MCP read failed: {exc.__class__.__name__}",
                },
                "records": [],
            }
        return {
            "status": status.__dict__,
            "records": records,
        }

    def fetch_similar_high_risk_records(self, *, property_payload: dict[str, Any], limit: int = 5) -> dict[str, Any]:
        status = self.status()
        if not status.connected or self.collection is None:
            return {
                "status": status.__dict__,
                "records": [],
            }

        or_filters: list[dict[str, Any]] = []
        village = property_payload.get("village")
        district = property_payload.get("district")
        khasra_no = property_payload.get("khasra_no")
        owner_name = property_payload.get("owner_name")
        if village:
            or_filters.append({"extracted_entities.village": village})
        if district:
            or_filters.append({"extracted_entities.district": district})
        if khasra_no:
            or_filters.append({"extracted_entities.khasra_no": khasra_no})
        if owner_name:
            or_filters.append({"extracted_entities.owner_name": owner_name})

        query: dict[str, Any] = {"is_high_risk": True}
        if or_filters:
            query["$or"] = or_filters

        try:
            records = list(
                self.collection.find(query, {"_id": 0})
                .sort("risk_report.risk_score", DESCENDING)
                .limit(limit)
            )
        except Exception as exc:
            return {
                "status": {
                    "enabled": status.enabled,
                    "connected": False,
                    "reason": f"MongoDB MCP read failed: {exc.__class__.__name__}",
                },
                "records": [],
            }
        return {
            "status": status.__dict__,
            "records": records,
        }

    def compare_property(self, *, db: Session, property_id: int) -> dict[str, Any]:
        extracted = db.get(ExtractedPropertyData, property_id)
        if not extracted:
            raise ValueError("Property not found")

        report = (
            db.query(AIReport)
            .filter(AIReport.property_data_id == property_id)
            .order_by(AIReport.created_at.desc())
            .first()
        )
        current_payload = {
            "id": extracted.id,
            "owner_name": extracted.owner_name,
            "khasra_no": extracted.khasra_no,
            "village": extracted.village,
            "district": extracted.district,
            "area": extracted.area,
            "coordinates": extracted.coordinates,
            "document_date": _iso(extracted.document_date),
            "current_risk_score": report.risk_score if report else None,
            "current_risk_level": report.risk_level if report else None,
            "current_summary": report.summary if report else None,
        }
        similar_context = self.fetch_similar_high_risk_records(property_payload=current_payload)
        similar_records = []
        for record in similar_context["records"]:
            if record.get("document_id") == extracted.document_id:
                continue
            entities = record.get("extracted_entities") or {}
            reasons: list[str] = []
            if current_payload.get("khasra_no") and current_payload.get("khasra_no") == entities.get("khasra_no"):
                reasons.append(f"Khasra match: {current_payload.get('khasra_no')}")
            if current_payload.get("owner_name") and current_payload.get("owner_name") == entities.get("owner_name"):
                reasons.append(f"Owner match: {current_payload.get('owner_name')}")
            if current_payload.get("village") and current_payload.get("village") == entities.get("village"):
                reasons.append(f"Village match: {current_payload.get('village')}")
            if current_payload.get("district") and current_payload.get("district") == entities.get("district"):
                reasons.append(f"District match: {current_payload.get('district')}")
            if not reasons:
                reasons.append("Matched as a similar high-risk precedent from the MongoDB MCP case memory.")
            similar_records.append({**record, "match_reasons": reasons})
        comparison = ai_service.compare_with_high_risk_records(
            property_payload=current_payload,
            similar_records=similar_records,
        )
        return {
            "mongodb_status": similar_context["status"],
            "current_property": current_payload,
            "similar_records": similar_records,
            "comparison": comparison,
        }


mongodb_mcp_service = MongoDBMCPService()
