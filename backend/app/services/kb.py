"""Tiny keyword-RAG over the bundled markdown knowledge base.

Sections are split on `##` headers; retrieval is simple token-overlap scoring —
deliberately transparent (a reviewer can read exactly why a chunk matched).
"""

from __future__ import annotations

import re
from pathlib import Path

KB_DIR = Path(__file__).resolve().parent.parent / "kb"

_chunks: list[dict] | None = None


def _load() -> list[dict]:
    global _chunks
    if _chunks is not None:
        return _chunks
    _chunks = []
    if KB_DIR.exists():
        for md in sorted(KB_DIR.glob("*.md")):
            text = md.read_text(encoding="utf-8")
            parts = re.split(r"(?m)^##\s+", text)
            for section in parts[1:]:
                title, _, body = section.partition("\n")
                _chunks.append(
                    {"source": md.name, "title": title.strip(), "text": body.strip()}
                )
    return _chunks


def reload() -> None:
    global _chunks
    _chunks = None


def retrieve(query: str, top_k: int = 3) -> list[dict]:
    tokens = set(re.findall(r"[a-z]{3,}", query.lower()))
    if not tokens:
        return []
    scored = []
    for chunk in _load():
        hay = (chunk["title"] + " " + chunk["text"]).lower()
        title_tokens = set(re.findall(r"[a-z]{3,}", chunk["title"].lower()))
        score = sum(1 for t in tokens if t in hay)
        score += 2 * len(tokens & title_tokens)
        if score > 0:
            scored.append((score, chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [c for _, c in scored[:top_k]]
