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


class JobProvider(Protocol):
    name: str
    def enabled(self) -> bool: ...
    def search(self, query: str, location: str = "", limit: int = 20) -> list[ProviderJob]: ...
