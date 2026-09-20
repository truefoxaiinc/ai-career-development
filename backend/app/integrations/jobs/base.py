from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol


@dataclass(slots=True)
class ProviderJob:
    source: str
    external_id: str
    title: str
    company: str
    location: str
    description: str
    apply_url: str
    requirements: dict[str, Any] = field(default_factory=dict)
    remote_mode: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str | None = None
    employment_type: str | None = None
    posted_at: datetime | None = None
    raw_meta: dict[str, Any] = field(default_factory=dict)

    # Normalized global-search fields are appended after the original
    # ProviderJob fields to preserve positional compatibility with any
    # existing tests or custom providers.
    country: str = ""
    country_code: str | None = None
    city: str | None = None
    category: str | None = None
    occupation: str | None = None

    # None means unknown/not supplied by the provider. Do not coerce a
    # missing value to False because that would incorrectly claim that a
    # benefit or permission is unavailable.
    visa_sponsorship: bool | None = None
    relocation_support: bool | None = None
    work_authorization: str | None = None


class JobProvider(Protocol):
    name: str

    def enabled(self) -> bool: ...

    def search(
        self,
        query: str,
        location: str = "",
        limit: int = 20,
    ) -> list[ProviderJob]: ...
