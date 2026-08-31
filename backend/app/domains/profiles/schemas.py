from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field


class CandidateUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    headline: str | None = Field(default=None, max_length=250)
    location: str | None = Field(default=None, max_length=250)
    phone: str | None = Field(default=None, max_length=64)
    links: dict[str, str] | None = None
    profile_summary: str | None = Field(default=None, max_length=4000)


class ProfileEntryCreate(BaseModel):
    entry_type: Literal["education","experience","skill","certification","project","publication","achievement","language","personal"]
    label: str = Field(min_length=1, max_length=250)
    structured_data: dict[str, Any] = Field(default_factory=dict)
    source_text: str | None = Field(default=None, max_length=8000)


class ProfileEntryUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=250)
    structured_data: dict[str, Any] | None = None
    source_text: str | None = Field(default=None, max_length=8000)


class VerificationDecision(BaseModel):
    entry_id: uuid.UUID
    action: Literal["accept","edit","reject"]
    label: str | None = Field(default=None, max_length=250)
    structured_data: dict[str, Any] | None = None


class VerificationRequest(BaseModel):
    decisions: list[VerificationDecision] = Field(min_length=1, max_length=200)


class JobPreferencePayload(BaseModel):
    target_titles: list[str] = Field(default_factory=list, max_length=20)
    industries: list[str] = Field(default_factory=list, max_length=20)
    locations: list[str] = Field(default_factory=list, max_length=20)
    work_modes: list[str] = Field(default_factory=list, max_length=5)
    salary_min: int | None = Field(default=None, ge=0)
    salary_currency: str | None = Field(default=None, max_length=8)
    employment_types: list[str] = Field(default_factory=list, max_length=10)
    relocation_willing: bool = False
    experience_levels: list[str] = Field(default_factory=list, max_length=10)
    preferred_companies: list[str] = Field(default_factory=list, max_length=50)
    alert_frequency: Literal["off","daily","weekly"] = "weekly"
