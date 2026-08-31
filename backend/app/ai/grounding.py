from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Iterable

from app.models.entities import Candidate, ProfileEntry

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"ignore\s+the\s+system\s+prompt",
    r"system\s+message",
    r"developer\s+message",
    r"you\s+are\s+chatgpt",
    r"reveal\s+.*prompt",
    r"follow\s+these\s+instructions",
    r"do\s+not\s+follow\s+.*instructions",
]


def detect_prompt_injection(text: str) -> list[str]:
    lowered = text.lower()
    return [pattern for pattern in INJECTION_PATTERNS if re.search(pattern, lowered)]


def isolate_untrusted_text(text: str, max_chars: int = 80_000) -> str:
    """Bound external text and remove control characters. It remains data, never instructions."""
    bounded = text[:max_chars]
    return "".join(ch for ch in bounded if ch in "\n\t" or ord(ch) >= 32)


def _tokens(text: str) -> set[str]:
    stop = {"the", "and", "for", "with", "from", "that", "this", "into", "your", "our", "are", "was", "were", "have", "has", "had", "will", "would", "a", "an", "to", "of", "in", "on", "by", "as", "at", "or", "is", "be", "i", "my", "verified", "profile", "background", "grounded", "experience", "skills", "skill", "current", "professional", "headline", "include", "includes"}
    return {t for t in re.findall(r"[a-zA-Z][a-zA-Z0-9+#.\-]{1,}", text.lower()) if t not in stop}


def _numbers(text: str) -> set[str]:
    return set(re.findall(r"(?<![A-Za-z])\d+(?:\.\d+)?%?", text))


def _entry_text(entry: ProfileEntry) -> str:
    return " ".join([
        entry.label,
        entry.source_text or "",
        json.dumps(entry.structured_data, ensure_ascii=False, sort_keys=True),
    ])


def claim_supported(claim: str, candidate: Candidate, entries: Iterable[ProfileEntry]) -> tuple[bool, str | None, float]:
    claim_tokens = _tokens(claim)
    claim_numbers = _numbers(claim)
    if len(claim_tokens) <= 2 and not claim_numbers:
        return True, None, 1.0

    candidate_text = " ".join([candidate.name, candidate.headline, candidate.location, candidate.profile_summary])
    verified_entries = [entry for entry in entries if entry.verified]
    sources: list[tuple[str, str]] = [("candidate", candidate_text)]
    sources.extend((str(entry.id), _entry_text(entry)) for entry in verified_entries)
    sources.append(("verified_profile_combined", " ".join(_entry_text(entry) for entry in verified_entries)))

    best_id: str | None = None
    best_score = 0.0
    for source_id, source_text in sources:
        source_tokens = _tokens(source_text)
        source_numbers = _numbers(source_text)
        if claim_numbers and not claim_numbers.issubset(source_numbers):
            continue
        if not claim_tokens:
            score = 1.0
        else:
            overlap = len(claim_tokens & source_tokens)
            score = overlap / max(len(claim_tokens), 1)
        if score > best_score:
            best_score = score
            best_id = source_id
    return best_score >= 0.34, best_id, round(best_score, 3)


def extract_claims(content: str) -> list[str]:
    candidates: list[str] = []
    for raw in re.split(r"\n+|(?<=[.!?])\s+(?=[A-Z])", content):
        line = raw.strip().lstrip("•-* ").strip()
        if len(line) < 18:
            continue
        # Skip clearly non-factual headings / salutations.
        if line.lower().startswith(("dear ", "sincerely", "professional summary", "experience", "skills", "education", "projects", "certifications", "i am applying", "i am excited to apply", "thank you", "this role", "your team", "my background is grounded")):
            continue
        candidates.append(line)
    return candidates


def verify_document_claims(content: str, candidate: Candidate, entries: Iterable[ProfileEntry]) -> dict:
    claims = extract_claims(content)
    results = []
    unsupported = 0
    for claim in claims:
        supported, source_id, confidence = claim_supported(claim, candidate, entries)
        if not supported:
            unsupported += 1
        results.append({"claim": claim, "supported": supported, "source_entry_id": source_id, "confidence": confidence})
    return {
        "status": "passed" if unsupported == 0 else "blocked",
        "total_claims": len(results),
        "unsupported_claims": unsupported,
        "claims": results,
    }
