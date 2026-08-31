from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field


class GenerateDocumentRequest(BaseModel):
    job_id: uuid.UUID
    document_type: Literal["resume", "cover_letter"]
    template: Literal["ats", "professional", "technical", "academic", "executive", "research", "minimal"] = "ats"


class DocumentEditRequest(BaseModel):
    content: str = Field(min_length=20, max_length=100_000)
    title: str | None = Field(default=None, max_length=300)
