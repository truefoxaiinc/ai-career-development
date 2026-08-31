from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field

APPLICATION_STATUSES = ["Recommended","Saved","Resume generated","Applied","Screening","Interview","Technical interview","Offer","Rejected","Withdrawn"]


class ApplicationCreate(BaseModel):
    job_id: uuid.UUID
    resume_document_id: uuid.UUID | None = None
    cover_letter_document_id: uuid.UUID | None = None
    notes: str = Field(default="", max_length=10_000)


class ApplicationUpdate(BaseModel):
    status: Literal["Recommended","Saved","Resume generated","Applied","Screening","Interview","Technical interview","Offer","Rejected","Withdrawn"] | None = None
    notes: str | None = Field(default=None, max_length=10_000)
    outcome: str | None = Field(default=None, max_length=500)


class ApplicationApproval(BaseModel):
    approved: bool


class MarkAppliedRequest(BaseModel):
    confirmed: bool


class DraftAnswersRequest(BaseModel):
    questions: list[str] = Field(min_length=1, max_length=20)
