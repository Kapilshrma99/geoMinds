from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from pypdf import PdfReader


def extract_text(file_path: str) -> str:
    path = Path(file_path)
    if path.suffix.lower() == ".pdf":
        try:
            reader = PdfReader(file_path)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            if text.strip():
                return text
        except Exception:
            pass
    return path.read_text(encoding="utf-8", errors="ignore")


def infer_property_fields(text: str, filename: str) -> dict:
    patterns = {
        "owner_name": r"(?:owner|name)\s*[:\-]\s*([A-Za-z\s]+)",
        "khasra_no": r"(?:khasra|survey)\s*(?:no|number)?\s*[:\-]?\s*([\w/-]+)",
        "village": r"village\s*[:\-]\s*([A-Za-z\s]+)",
        "district": r"district\s*[:\-]\s*([A-Za-z\s]+)",
        "area": r"area\s*[:\-]?\s*([\d.]+)",
        "document_date": r"(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})",
    }
    result = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text, flags=re.IGNORECASE)
        result[key] = match.group(1).strip() if match else None

    if result["document_date"]:
        raw = result["document_date"]
        for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
            try:
                result["document_date"] = datetime.strptime(raw, fmt).date()
                break
            except ValueError:
                continue

    if result["area"]:
        result["area"] = float(result["area"])

    chunks = [chunk.strip() for chunk in text.split("\n") if chunk.strip()]
    result["chunks"] = chunks[:8] if chunks else [f"Uploaded file: {filename}"]
    result["coordinates"] = None
    return result


def chunk_document_text(text: str, chunk_size: int = 900, overlap: int = 150) -> list[str]:
    normalized = " ".join(text.split())
    if not normalized:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(len(normalized), start + chunk_size)
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(normalized):
            break
        start = max(end - overlap, start + 1)
    return chunks
