from __future__ import annotations

from app.models import AgentExecutionLog
from app.services.execution_stream import publish_execution_event


def create_agent_log(
    *,
    agent_name: str,
    message: str,
    status: str = "completed",
    run_type: str,
    user_id: int | None = None,
    document_id: int | None = None,
    property_data_id: int | None = None,
    report_id: int | None = None,
    metadata: dict | None = None,
) -> dict[str, str]:
    return {
        "agent": agent_name,
        "message": message,
        "status": status,
        "run_type": run_type,
        "user_id": user_id,
        "document_id": document_id,
        "property_data_id": property_data_id,
        "report_id": report_id,
        "metadata": metadata,
    }


def persist_agent_logs(db, logs: list[dict[str, str]]) -> None:
    if not logs:
        return
    for entry in logs:
        persist_agent_log(db, entry)


def persist_agent_log(db, entry: dict[str, str]) -> AgentExecutionLog:
    row = AgentExecutionLog(
        user_id=entry.get("user_id"),
        document_id=entry.get("document_id"),
        property_data_id=entry.get("property_data_id"),
        report_id=entry.get("report_id"),
        run_type=entry.get("run_type", "general"),
        agent_name=entry["agent"],
        status=entry.get("status", "completed"),
        message=entry["message"],
        log_metadata=entry.get("metadata"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    publish_execution_event(
        {
            "id": row.id,
            "agent": row.agent_name,
            "message": row.message,
            "status": row.status,
            "run_type": row.run_type,
            "document_id": row.document_id,
            "property_data_id": row.property_data_id,
            "report_id": row.report_id,
            "metadata": row.log_metadata or {},
            "created_at": row.created_at.isoformat(),
        }
    )
    return row


def public_agent_logs(logs: list[dict[str, str]]) -> list[dict[str, str]]:
    return [
        {
            "agent": entry["agent"],
            "message": entry["message"],
            "status": entry.get("status", "completed"),
            "created_at": entry.get("created_at"),
            "metadata": entry.get("metadata") or {},
        }
        for entry in logs
    ]
