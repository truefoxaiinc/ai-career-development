from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ManualJobRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    company: str = Field(min_length=1, max_length=300)

    # Provider display location plus normalized geography.
    location: str = Field(default="", max_length=300)
    country: str = Field(default="", max_length=120)
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    city: str | None = Field(default=None, max_length=160)

    # Generic classification fields.
    category: str | None = Field(default=None, max_length=120)
    occupation: str | None = Field(default=None, max_length=180)

    # remote / hybrid / onsite when known.
    remote_mode: Literal["remote", "hybrid", "onsite"] | None = None

    description: str = Field(min_length=30, max_length=100_000)

    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str | None = Field(default=None, max_length=8)
    employment_type: str | None = Field(default=None, max_length=64)

    # None means the source did not disclose the information.
    visa_sponsorship: bool | None = None
    relocation_support: bool | None = None
    work_authorization: str | None = Field(default=None, max_length=250)

    apply_url: str = Field(default="", max_length=4000)


class DiscoverJobsRequest(BaseModel):
    limit_per_provider: int = Field(default=20, ge=1, le=50)
    max_results: int = Field(default=50, ge=1, le=100)


class SaveJobRequest(BaseModel):
    note: str = Field(default="", max_length=4000)
