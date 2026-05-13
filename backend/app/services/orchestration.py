from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from time import perf_counter
from typing import Any

from sqlalchemy.orm import Session

from app.models import ConflictReport, ExtractedPropertyData, PropertyMatch, UploadedDocument
from app.services.agent_logs import create_agent_log, persist_agent_log, public_agent_logs
from app.services.agents import calculate_risk_baseline, generate_risk_report
from app.services.ai_service import ai_service
from app.services.document_ai import extract_text, infer_property_fields
from app.services.gis import detect_conflicts, find_best_match
from app.services.rag import index_document_chunks

EXTRACTED_PROPERTY_FIELDS = {
    "owner_name",
    "khasra_no",
    "village",
    "district",
    "area",
    "coordinates",
    "document_date",
    "chunks",
}


@dataclass
class AgentContext:
    db: Session
    user_id: int
    document: UploadedDocument
    state: dict[str, Any] = field(default_factory=dict)
    public_logs: list[dict[str, str]] = field(default_factory=list)

    def emit(self, agent_name: str, message: str, status: str = "completed", metadata: dict | None = None) -> None:
        workflow_plan = self.state.get("workflow_plan") or []
        progress_index = next((index for index, item in enumerate(workflow_plan) if item == agent_name), None)
        event_metadata = {
            "progress_index": progress_index,
            "progress_total": len(workflow_plan),
            **(metadata or {}),
        }
        entry = create_agent_log(
            agent_name=agent_name,
            message=message,
            status=status,
            run_type="document_analysis",
            user_id=self.user_id,
            document_id=self.document.id,
            property_data_id=self.state.get("property_data_id"),
            report_id=self.state.get("report_id"),
            metadata=event_metadata,
        )
        persist_agent_log(self.db, entry)
        entry["created_at"] = datetime.utcnow().isoformat()
        self.public_logs = public_agent_logs(self.public_logs + [entry])


class WorkflowAgent:
    name: str

    def run(self, context: AgentContext) -> None:
        raise NotImplementedError


class PlannerAgent(WorkflowAgent):
    name = "Planner Agent"

    def run(self, context: AgentContext) -> None:
        started_at = perf_counter()
        context.emit(
            self.name,
            "Planning sequential workflow with shared state for document, GIS, conflict, risk, and report stages.",
            status="running",
            metadata={"phase": "planning", "progress": 0.08},
        )
        context.state["workflow_plan"] = [
            "Document Agent",
            "GIS Agent",
            "Conflict Agent",
            "Risk Agent",
            "Report Agent",
        ]
        context.emit(
            self.name,
            "Delegation plan created using ADK-style sequential orchestration and shared state.",
            metadata={
                "phase": "planning",
                "progress": 0.12,
                "duration_ms": round((perf_counter() - started_at) * 1000, 1),
                "sub_agents": context.state["workflow_plan"],
            },
        )


class DocumentAgent(WorkflowAgent):
    name = "Document Agent"

    def run(self, context: AgentContext) -> None:
        started_at = perf_counter()
        context.emit(
            self.name,
            "Extracting text, ownership entities, cadastral identifiers, and cited document chunks.",
            status="running",
            metadata={"phase": "document_ingestion", "progress": 0.2},
        )
        raw_text = extract_text(context.document.storage_path)
        fields, _ = ai_service.extract_property_data(raw_text=raw_text, filename=context.document.filename)
        fields = {key: value for key, value in fields.items() if key in EXTRACTED_PROPERTY_FIELDS}
        if not fields.get("chunks"):
            fields["chunks"] = infer_property_fields(raw_text, context.document.filename)["chunks"]

        context.document.raw_text = raw_text
        context.document.status = "analyzed"
        context.db.add(context.document)
        context.db.commit()

        extracted = (
            context.db.query(ExtractedPropertyData)
            .filter(ExtractedPropertyData.document_id == context.document.id)
            .first()
        )
        if not extracted:
            extracted = ExtractedPropertyData(document_id=context.document.id, **fields)
            context.db.add(extracted)
        else:
            for key, value in fields.items():
                setattr(extracted, key, value)
            context.db.add(extracted)
        context.db.commit()
        context.db.refresh(extracted)

        context.state["raw_text"] = raw_text
        context.state["extracted"] = extracted
        context.state["property_data_id"] = extracted.id
        context.emit(
            self.name,
            "Chunking extracted text and generating embeddings for the pgvector knowledge store.",
            status="running",
            metadata={"phase": "knowledge_indexing", "progress": 0.34},
        )
        chunk_rows = index_document_chunks(
            context.db,
            document_id=context.document.id,
            property_data_id=extracted.id,
            filename=context.document.filename,
            text=raw_text,
        )
        context.state["document_chunks"] = chunk_rows
        context.emit(
            self.name,
            f"Extracted khasra {extracted.khasra_no or 'unknown'}, owner {extracted.owner_name or 'unknown'}, village {extracted.village or 'unknown'}, and indexed {len(chunk_rows)} chunks.",
            metadata={
                "phase": "document_ingestion",
                "progress": 0.4,
                "duration_ms": round((perf_counter() - started_at) * 1000, 1),
                "document_id": context.document.id,
                "property_data_id": extracted.id,
                "evidence_count": len(chunk_rows),
            },
        )


class GISAgent(WorkflowAgent):
    name = "GIS Agent"

    def run(self, context: AgentContext) -> None:
        started_at = perf_counter()
        context.emit(
            self.name,
            "Matching extracted property state against parcel records and spatial metadata.",
            status="running",
            metadata={"phase": "parcel_matching", "progress": 0.5},
        )
        extracted: ExtractedPropertyData = context.state["extracted"]
        match = find_best_match(context.db, extracted)
        context.state["match"] = match
        if match:
            context.emit(
                self.name,
                f"Matched property to parcel {match.parcel_id} with confidence score {match.match_score:.0f}.",
                metadata={
                    "phase": "parcel_matching",
                    "progress": 0.58,
                    "duration_ms": round((perf_counter() - started_at) * 1000, 1),
                    "match_score": match.match_score,
                    "parcel_id": match.parcel_id,
                },
            )
        else:
            context.emit(
                self.name,
                "No reliable parcel match found from the available cadastral signals.",
                status="completed",
                metadata={
                    "phase": "parcel_matching",
                    "progress": 0.58,
                    "duration_ms": round((perf_counter() - started_at) * 1000, 1),
                    "match_score": 0,
                },
            )


class ConflictAgent(WorkflowAgent):
    name = "Conflict Agent"

    def run(self, context: AgentContext) -> None:
        started_at = perf_counter()
        context.emit(
            self.name,
            "Checking overlap, ownership mismatch, duplicate khasra, missing geometry, and area anomalies.",
            status="running",
            metadata={"phase": "conflict_detection", "progress": 0.66},
        )
        extracted: ExtractedPropertyData = context.state["extracted"]
        match: PropertyMatch | None = context.state.get("match")
        conflicts = detect_conflicts(context.db, extracted, match)
        context.state["conflicts"] = conflicts
        high_or_medium = sum(1 for item in conflicts if item.severity in {"high", "medium"})
        context.emit(
            self.name,
            f"Conflict scan finished with {len(conflicts)} findings, including {high_or_medium} elevated-risk signals.",
            metadata={
                "phase": "conflict_detection",
                "progress": 0.75,
                "duration_ms": round((perf_counter() - started_at) * 1000, 1),
                "conflict_count": len(conflicts),
                "elevated_count": high_or_medium,
            },
        )


class RiskAgent(WorkflowAgent):
    name = "Risk Agent"

    def run(self, context: AgentContext) -> None:
        started_at = perf_counter()
        context.emit(
            self.name,
            "Computing baseline risk score and preparing evidence for Gemini reasoning.",
            status="running",
            metadata={"phase": "risk_scoring", "progress": 0.82},
        )
        extracted: ExtractedPropertyData = context.state["extracted"]
        match: PropertyMatch | None = context.state.get("match")
        conflicts: list[ConflictReport] = context.state.get("conflicts", [])
        baseline = calculate_risk_baseline(extracted, match, conflicts)
        context.state["risk_baseline"] = baseline
        context.emit(
            self.name,
            f"Baseline risk computed as {baseline['heuristic_level']} ({baseline['heuristic_score']}/100) before report synthesis.",
            metadata={
                "phase": "risk_scoring",
                "progress": 0.88,
                "duration_ms": round((perf_counter() - started_at) * 1000, 1),
                "heuristic_score": baseline["heuristic_score"],
                "heuristic_level": baseline["heuristic_level"],
                "reason_count": len(baseline.get("reasons", [])),
            },
        )


class ReportAgent(WorkflowAgent):
    name = "Report Agent"

    def run(self, context: AgentContext) -> None:
        started_at = perf_counter()
        context.emit(
            self.name,
            "Generating the final intelligence report from shared workflow state.",
            status="running",
            metadata={"phase": "report_synthesis", "progress": 0.94},
        )
        extracted: ExtractedPropertyData = context.state["extracted"]
        match: PropertyMatch | None = context.state.get("match")
        conflicts: list[ConflictReport] = context.state.get("conflicts", [])
        report = generate_risk_report(
            context.db,
            extracted,
            match,
            conflicts,
            baseline=context.state.get("risk_baseline"),
        )
        context.state["report"] = report
        context.state["report_id"] = report.id
        context.emit(
            self.name,
            f"Property intelligence report #{report.id} generated with {report.risk_level} risk rating ({report.risk_score}/100).",
            metadata={
                "phase": "report_synthesis",
                "progress": 1.0,
                "duration_ms": round((perf_counter() - started_at) * 1000, 1),
                "report_id": report.id,
                "risk_score": report.risk_score,
                "risk_level": report.risk_level,
            },
        )


class SequentialWorkflow:
    def __init__(self, sub_agents: list[WorkflowAgent]) -> None:
        self.sub_agents = sub_agents

    def run(self, context: AgentContext) -> AgentContext:
        for agent in self.sub_agents:
            agent.run(context)
        return context


class GeoMindOrchestrator:
    def __init__(self) -> None:
        self.pipeline = SequentialWorkflow(
            [
                PlannerAgent(),
                DocumentAgent(),
                GISAgent(),
                ConflictAgent(),
                RiskAgent(),
                ReportAgent(),
            ]
        )

    def analyze_document(self, *, db: Session, user_id: int, document: UploadedDocument) -> AgentContext:
        context = AgentContext(db=db, user_id=user_id, document=document)
        return self.pipeline.run(context)


geomind_orchestrator = GeoMindOrchestrator()
