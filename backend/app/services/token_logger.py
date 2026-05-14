from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import json

from app.core.config import settings


def estimate_text_tokens(text: str | None) -> int:
    if not text:
        return 0
    normalized = " ".join(str(text).split())
    if not normalized:
        return 0
    return max(1, round(len(normalized) / 4))


def extract_usage_metadata(usage_metadata: Any) -> dict[str, int] | None:
    if not usage_metadata:
        return None

    def read_field(name: str) -> Any:
        value = getattr(usage_metadata, name, None)
        if value is None and isinstance(usage_metadata, dict):
            value = usage_metadata.get(name)
        return value

    prompt_tokens = read_field("prompt_token_count")
    response_tokens = read_field("candidates_token_count")
    total_tokens = read_field("total_token_count")
    cached_tokens = read_field("cached_content_token_count")
    thoughts_tokens = read_field("thoughts_token_count")
    tool_use_prompt_tokens = read_field("tool_use_prompt_token_count")

    if (
        prompt_tokens is None
        and response_tokens is None
        and total_tokens is None
        and cached_tokens is None
        and thoughts_tokens is None
        and tool_use_prompt_tokens is None
    ):
        return None

    prompt_tokens = int(prompt_tokens or 0)
    response_tokens = int(response_tokens or 0)
    cached_tokens = int(cached_tokens or 0)
    thoughts_tokens = int(thoughts_tokens or 0)
    tool_use_prompt_tokens = int(tool_use_prompt_tokens or 0)
    total_tokens = int(total_tokens or (prompt_tokens + response_tokens + cached_tokens + thoughts_tokens + tool_use_prompt_tokens))

    return {
        "prompt_tokens": prompt_tokens,
        "response_tokens": response_tokens,
        "cached_tokens": cached_tokens,
        "thoughts_tokens": thoughts_tokens,
        "tool_use_prompt_tokens": tool_use_prompt_tokens,
        "total_tokens": total_tokens,
    }


def serialize_usage_metadata(usage_metadata: Any) -> dict[str, Any] | None:
    usage = extract_usage_metadata(usage_metadata)
    if usage is None:
        return None
    return usage


def write_token_log(entry: dict[str, Any]) -> None:
    path = Path(settings.token_log_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **entry,
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, default=str, ensure_ascii=True) + "\n")
