from __future__ import annotations

import json
import os
from typing import Any, Iterable
from datetime import datetime

from app.core.config import settings
from app.services.document_ai import infer_property_fields

try:
    from google import genai
    from google.genai import types
    from google.genai.types import EmbedContentConfig, GenerateContentConfig, HttpOptions
except Exception:  # pragma: no cover
    genai = None
    types = None
    EmbedContentConfig = None
    GenerateContentConfig = None
    HttpOptions = None


class AIService:
    def __init__(self) -> None:
        self._client = None
        self._configured = False
        self._setup_environment()

    def _setup_environment(self) -> None:
        if settings.google_application_credentials:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.google_application_credentials
        if settings.google_genai_use_vertexai:
            if settings.google_cloud_project:
                os.environ["GOOGLE_CLOUD_PROJECT"] = settings.google_cloud_project
            os.environ["GOOGLE_CLOUD_LOCATION"] = settings.google_cloud_location
            os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
            self._configured = True
        elif settings.gemini_api_key and settings.gemini_api_key != "your-gemini-api-key":
            self._configured = True

    @property
    def client(self):
        if self._client is None and genai is not None:
            kwargs: dict[str, Any] = {}
            if not settings.google_genai_use_vertexai:
                kwargs["api_key"] = settings.gemini_api_key
            kwargs["http_options"] = HttpOptions(api_version="v1")
            self._client = genai.Client(**kwargs)
        return self._client

    def available(self) -> bool:
        return self._configured and genai is not None

    def _generate_json(self, *, model: str, prompt: str, system_instruction: str) -> dict[str, Any]:
        if not self.available():
            raise RuntimeError("Gemini service not configured")
        response = self.client.models.generate_content(
            model=model,
            contents=prompt,
            config=GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=settings.gemini_temperature,
                candidate_count=1,
                response_mime_type="application/json",
            ),
        )
        text = (response.text or "").strip()
        return json.loads(text)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if not self.available():
            return [self._fallback_embedding(text) for text in texts]
        try:
            response = self.client.models.embed_content(
                model=settings.gemini_embedding_model,
                contents=texts,
                config=EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=settings.embedding_dimensions,
                ),
            )
            return [list(item.values) for item in response.embeddings]
        except Exception:
            return [self._fallback_embedding(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        if not self.available():
            return self._fallback_embedding(text)
        try:
            response = self.client.models.embed_content(
                model=settings.gemini_embedding_model,
                contents=text,
                config=EmbedContentConfig(
                    task_type="RETRIEVAL_QUERY",
                    output_dimensionality=settings.embedding_dimensions,
                ),
            )
            return list(response.embeddings[0].values)
        except Exception:
            return self._fallback_embedding(text)

    def _fallback_embedding(self, text: str) -> list[float]:
        dims = settings.embedding_dimensions
        vector = [0.0] * dims
        for index, char in enumerate(text.encode("utf-8")):
            vector[index % dims] += ((char % 31) + 1) / 100.0
        magnitude = sum(value * value for value in vector) ** 0.5 or 1.0
        return [value / magnitude for value in vector]

    def extract_property_data(self, *, raw_text: str, filename: str) -> tuple[dict[str, Any], list[dict[str, str]]]:
        fallback = infer_property_fields(raw_text, filename)
        logs = [
            {"agent": "Planner Agent", "message": "Prepared a structured extraction task for the Gemini document agent."},
        ]
        prompt = (
            "Extract land intelligence fields from the uploaded document. "
            "Return strict JSON with keys: owner_name, khasra_no, village, district, area, "
            "coordinates, document_date, chunks. "
            "coordinates must be null or a JSON object. chunks must be an array of concise cited excerpts. "
            f"Filename: {filename}\n\nDocument:\n{raw_text[:18000]}"
        )
        system_instruction = (
            "You are GeoMind AI's Document Agent. Extract only what is supported by the document. "
            "Use ISO date format YYYY-MM-DD when date is available."
        )
        try:
            result = self._generate_json(model=settings.gemini_model, prompt=prompt, system_instruction=system_instruction)
            result["area"] = float(result["area"]) if result.get("area") not in (None, "") else None
            if result.get("document_date"):
                try:
                    result["document_date"] = datetime.fromisoformat(result["document_date"]).date()
                except ValueError:
                    result["document_date"] = fallback.get("document_date")
            result["chunks"] = (result.get("chunks") or fallback["chunks"] or [])[:8]
            logs.append({"agent": "Document Agent", "message": "Gemini extracted structured ownership and cadastral fields from the uploaded document."})
            return result, logs
        except Exception as exc:
            logs.append({"agent": "Document Agent", "message": f"Gemini extraction unavailable, fell back to deterministic parser: {exc.__class__.__name__}."})
            return fallback, logs

    def generate_report(
        self,
        *,
        extracted_payload: dict[str, Any],
        match_payload: dict[str, Any] | None,
        conflicts_payload: list[dict[str, Any]],
        heuristic_score: int,
        heuristic_level: str,
    ) -> tuple[dict[str, Any], list[dict[str, str]]]:
        logs = [
            {"agent": "Risk Agent", "message": "Prepared Gemini reasoning context from parcel match and conflict evidence."},
        ]
        prompt = (
            "Generate a property intelligence report as strict JSON with keys: "
            "risk_score, risk_level, summary, recommendation, reasoning, nearby_disputed_parcels, ownership_analysis, boundary_analysis. "
            "Keep risk_score between 0 and 100 and risk_level one of Low, Medium, High. "
            f"Heuristic baseline score: {heuristic_score}. Heuristic baseline level: {heuristic_level}. "
            f"Property: {json.dumps(extracted_payload)} "
            f"Match: {json.dumps(match_payload)} "
            f"Conflicts: {json.dumps(conflicts_payload)}"
        )
        system_instruction = (
            "You are GeoMind AI's Risk Analysis and Report Agent. Produce concise enterprise-style land intelligence output. "
            "Align risk score to the evidence and prefer conservative legal reasoning."
        )
        try:
            result = self._generate_json(model=settings.gemini_report_model, prompt=prompt, system_instruction=system_instruction)
            logs.append({"agent": "Report Agent", "message": "Gemini generated the final risk narrative and recommendation package."})
            return result, logs
        except Exception as exc:
            logs.append({"agent": "Report Agent", "message": f"Gemini report generation unavailable, used heuristic report synthesis: {exc.__class__.__name__}."})
            return {
                "risk_score": heuristic_score,
                "risk_level": heuristic_level,
                "summary": (
                    f"Property {extracted_payload.get('khasra_no') or 'unknown'} in "
                    f"{extracted_payload.get('village') or 'unknown village'} is rated {heuristic_level} risk with a score of {heuristic_score}."
                ),
                "recommendation": "Escalate for field verification and legal review." if heuristic_level != "Low" else "Proceed with routine due diligence.",
                "reasoning": [item["details"] for item in conflicts_payload] or ["No material conflicts detected."],
                "nearby_disputed_parcels": [],
                "ownership_analysis": "Ownership signals were compared between the uploaded document and matched parcel records.",
                "boundary_analysis": "Boundary conflict checks considered overlaps, duplicate parcel identifiers, and area mismatch.",
            }, logs

    def answer_gis_query(
        self,
        *,
        question: str,
        property_payload: dict[str, Any] | None,
        parcel_context: list[dict[str, Any]],
        report_payload: dict[str, Any] | None,
        retrieved_context: list[str],
        citations: list[str],
    ) -> tuple[str, list[dict[str, str]]]:
        logs = [
            {"agent": "Planner Agent", "message": "Classified the chat question as a conversational GIS query."},
            {"agent": "RAG Agent", "message": "Retrieved semantically similar document chunks from the pgvector knowledge store."},
            {"agent": "GIS Query Agent", "message": "Prepared parcel, ownership, conflict, and citation context for Gemini."},
        ]
        prompt = (
            "Answer the user's GIS/property intelligence question clearly and concretely. "
            "If the question asks why a property is risky, explain using the provided conflict and report context. "
            "If the question asks about overlaps or disputed parcels, summarize the parcel evidence. "
            f"Question: {question}\n"
            f"Property context: {json.dumps(property_payload)}\n"
            f"Parcel context: {json.dumps(parcel_context)}\n"
            f"Report context: {json.dumps(report_payload)}\n"
            f"Retrieved document context: {json.dumps(retrieved_context)}\n"
            f"Citations: {json.dumps(citations)}"
        )
        system_instruction = (
            "You are GeoMind AI's Chat Agent. Answer in a professional tone, grounded in the supplied property and GIS evidence. "
            "Do not invent parcel ids, owners, or disputes."
        )
        try:
            if not self.available():
                raise RuntimeError("Gemini service not configured")
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3,
                    candidate_count=1,
                ),
            )
            logs.append({"agent": "Chat Agent", "message": "Gemini produced a grounded conversational GIS answer."})
            return (response.text or "").strip(), logs
        except Exception as exc:
            logs.append({"agent": "Chat Agent", "message": f"Gemini chat unavailable, returned a deterministic fallback answer: {exc.__class__.__name__}."})
            answer = "GeoMind AI could not produce a live Gemini response."
            if report_payload and "why" in question.lower() and "risk" in question.lower():
                answer = (
                    f"This property is {report_payload.get('risk_level', 'unknown').lower()} risk "
                    f"({report_payload.get('risk_score', 0)}/100) because "
                    + "; ".join(report_payload.get("conflicts", [])[:3] if isinstance(report_payload.get("conflicts"), list) else [])
                )
            elif property_payload:
                answer = (
                    f"Khasra {property_payload.get('khasra_no') or 'unknown'} belongs to "
                    f"{property_payload.get('owner_name') or 'unknown owner'} in "
                    f"{property_payload.get('village') or 'unknown village'}, {property_payload.get('district') or 'unknown district'}."
                )
            return answer, logs

    def stream_gis_query(
        self,
        *,
        question: str,
        property_payload: dict[str, Any] | None,
        parcel_context: list[dict[str, Any]],
        report_payload: dict[str, Any] | None,
        retrieved_context: list[str],
        citations: list[str],
    ) -> tuple[Iterable[str], list[dict[str, str]]]:
        logs = [
            {"agent": "Planner Agent", "message": "Initialized a streaming conversational GIS response."},
            {"agent": "RAG Agent", "message": "Retrieved semantically similar document chunks from pgvector for streaming QA."},
            {"agent": "GIS Query Agent", "message": "Assembled RAG-style property and parcel context for streaming."},
        ]
        prompt = (
            "Answer the user's property intelligence question in a concise but informative way. "
            f"Question: {question}\nProperty context: {json.dumps(property_payload)}\n"
            f"Parcel context: {json.dumps(parcel_context)}\nReport context: {json.dumps(report_payload)}\n"
            f"Retrieved document context: {json.dumps(retrieved_context)}\n"
            f"Citations: {json.dumps(citations)}"
        )
        system_instruction = "You are GeoMind AI's streaming chat agent. Stay grounded in the provided GIS and land records context."
        if not self.available():
            def fallback_stream() -> Iterable[str]:
                yield "Gemini streaming is not configured. "
                if property_payload:
                    yield f"Khasra {property_payload.get('khasra_no') or 'unknown'} "
                    yield f"is associated with {property_payload.get('owner_name') or 'unknown owner'}."

            logs.append({"agent": "Chat Agent", "message": "Gemini streaming unavailable, emitted a fallback streamed answer."})
            return fallback_stream(), logs

        stream = self.client.models.generate_content_stream(
            model=settings.gemini_model,
            contents=prompt,
            config=GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3,
                candidate_count=1,
            ),
        )

        def iterator() -> Iterable[str]:
            for chunk in stream:
                text = getattr(chunk, "text", None)
                if text:
                    yield text

        logs.append({"agent": "Chat Agent", "message": "Gemini streaming response started successfully."})
        return iterator(), logs


ai_service = AIService()
