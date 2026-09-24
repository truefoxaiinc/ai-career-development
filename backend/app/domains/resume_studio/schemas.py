from __future__ import annotations

import uuid
from typing import Literal
from pydantic import BaseModel, Field


SuggestionCategory = Literal[
    "missing_information", "weak_summary", "skills", "achievement_quantification",
    "grammar_clarity", "ats_keywords", "formatting", "job_specific",
    "contact", "experience", "education", "projects", "certifications",
    "languages", "cover_letter_section",
]


class AISuggestion(BaseModel):
    category: SuggestionCategory
    priority: Literal["high", "medium", "low"]
    explanation: str = Field(min_length=3, max_length=2000)
    current_text: str = Field(default="", max_length=8000)
    suggested_text: str = Field(default="", max_length=8000)
    reason: str = Field(min_length=3, max_length=2000)


class AISuggestionResponse(BaseModel):
    suggestions: list[AISuggestion] = Field(max_length=40)


class SuggestionAction(BaseModel):
    action: Literal["apply", "dismiss"]
    document_id: uuid.UUID | None = None


class TargetRequest(BaseModel):
    job_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=300)
    company: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=100_000)
    template: Literal["ats", "modern", "minimal", "professional"] = "ats"
    document_type: Literal["resume", "cover_letter"] = "resume"
    source_file_id: uuid.UUID | None = None
    source_document_id: uuid.UUID | None = None
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=100)


class TemplateSelection(BaseModel):
    template: Literal["ats", "modern", "minimal", "professional"]

