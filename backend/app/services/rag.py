from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import DocumentChunk
from app.services.ai_service import ai_service
from app.services.document_ai import chunk_document_text


def build_chunk_records(text: str, filename: str) -> list[dict]:
    chunks = chunk_document_text(text)
    if not chunks:
        chunks = [f"Uploaded file {filename} had no extractable text."]
    return [
        {
            "chunk_index": index,
            "content": content,
            "citation_label": f"{filename} :: chunk {index + 1}",
        }
        for index, content in enumerate(chunks)
    ]


def index_document_chunks(
    db: Session,
    *,
    document_id: int,
    property_data_id: int | None,
    filename: str,
    text: str,
) -> list[DocumentChunk]:
    chunk_records = build_chunk_records(text, filename)
    embeddings = ai_service.embed_documents([item["content"] for item in chunk_records])
    db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
    db.commit()

    rows: list[DocumentChunk] = []
    for item, embedding in zip(chunk_records, embeddings, strict=False):
        row = DocumentChunk(
            document_id=document_id,
            property_data_id=property_data_id,
            chunk_index=item["chunk_index"],
            content=item["content"],
            citation_label=item["citation_label"],
            embedding=embedding,
        )
        db.add(row)
        rows.append(row)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


def retrieve_relevant_chunks(
    db: Session,
    *,
    question: str,
    property_data_id: int | None = None,
    document_id: int | None = None,
    top_k: int = 4,
) -> list[DocumentChunk]:
    query_embedding = ai_service.embed_query(question)
    try:
        stmt = select(DocumentChunk).where(DocumentChunk.embedding.is_not(None))
        if property_data_id is not None:
            stmt = stmt.where(DocumentChunk.property_data_id == property_data_id)
        if document_id is not None:
            stmt = stmt.where(DocumentChunk.document_id == document_id)
        stmt = stmt.order_by(DocumentChunk.embedding.cosine_distance(query_embedding)).limit(top_k)
        return list(db.scalars(stmt).all())
    except Exception:
        stmt = select(DocumentChunk)
        if property_data_id is not None:
            stmt = stmt.where(DocumentChunk.property_data_id == property_data_id)
        if document_id is not None:
            stmt = stmt.where(DocumentChunk.document_id == document_id)
        stmt = stmt.limit(top_k)
        return list(db.scalars(stmt).all())


def summarize_retrieved_chunks(chunks: list[DocumentChunk]) -> tuple[list[str], list[str]]:
    citations = [chunk.citation_label for chunk in chunks]
    context = [chunk.content for chunk in chunks]
    return context, citations
