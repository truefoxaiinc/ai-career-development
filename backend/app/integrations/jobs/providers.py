from __future__ import annotations

import base64
import re
from datetime import UTC, datetime
from typing import Any

import httpx

from app.ai.grounding import isolate_untrusted_text
from app.core.config import Settings
from .base import ProviderJob


def _clean_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", text).strip()


def _dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except ValueError:
        return None


class AdzunaProvider:
    name = "adzuna"
    def __init__(self, settings: Settings): self.s = settings
    def enabled(self): return bool(self.s.adzuna_app_id and self.s.adzuna_app_key)
    def search(self, query: str, location: str = "", limit: int = 20):
        if not self.enabled(): return []
        url = f"https://api.adzuna.com/v1/api/jobs/{self.s.adzuna_country}/search/1"
        params = {"app_id": self.s.adzuna_app_id, "app_key": self.s.adzuna_app_key, "what": query, "where": location, "results_per_page": min(limit, 50), "content-type": "application/json"}
        r = httpx.get(url, params=params, timeout=15.0); r.raise_for_status()
        out=[]
        for item in r.json().get("results", []):
            out.append(ProviderJob(source=self.name, external_id=str(item.get("id")), title=item.get("title") or "Untitled", company=(item.get("company") or {}).get("display_name") or "Unknown", location=(item.get("location") or {}).get("display_name") or "", description=isolate_untrusted_text(_clean_html(item.get("description") or "")), apply_url=item.get("redirect_url") or "", salary_min=item.get("salary_min"), salary_max=item.get("salary_max"), salary_currency="INR" if self.s.adzuna_country=="in" else None, posted_at=_dt(item.get("created")), raw_meta={"category": (item.get("category") or {}).get("label")}))
        return out


class JoobleProvider:
    name="jooble"
    def __init__(self, settings: Settings): self.s=settings
    def enabled(self): return bool(self.s.jooble_api_key)
    def search(self, query: str, location: str = "", limit: int = 20):
        if not self.enabled(): return []
        r=httpx.post(f"https://jooble.org/api/{self.s.jooble_api_key}", json={"keywords":query,"location":location,"page":1}, timeout=15.0); r.raise_for_status()
        return [ProviderJob(source=self.name,external_id=str(x.get("id") or x.get("link")),title=x.get("title") or "Untitled",company=x.get("company") or "Unknown",location=x.get("location") or "",description=isolate_untrusted_text(_clean_html(x.get("snippet") or "")),apply_url=x.get("link") or "",salary_currency=None,employment_type=x.get("type"),posted_at=_dt(x.get("updated"))) for x in r.json().get("jobs",[])[:limit]]


class USAJobsProvider:
    name="usajobs"
    def __init__(self, settings: Settings): self.s=settings
    def enabled(self): return bool(self.s.usajobs_api_key and self.s.usajobs_user_agent_email)
    def search(self, query: str, location: str = "", limit: int = 20):
        if not self.enabled(): return []
        headers={"Authorization-Key":self.s.usajobs_api_key,"User-Agent":self.s.usajobs_user_agent_email,"Host":"data.usajobs.gov"}
        params={"Keyword":query,"LocationName":location,"ResultsPerPage":min(limit,100)}
        r=httpx.get("https://data.usajobs.gov/api/search",headers=headers,params=params,timeout=15.0);r.raise_for_status()
        out=[]
        for x in r.json().get("SearchResult",{}).get("SearchResultItems",[]):
            m=x.get("MatchedObjectDescriptor",{}); details=m.get("UserArea",{}).get("Details",{})
            out.append(ProviderJob(source=self.name,external_id=str(m.get("PositionID")),title=m.get("PositionTitle") or "Untitled",company=m.get("OrganizationName") or m.get("DepartmentName") or "U.S. Government",location=", ".join(y.get("LocationName","") for y in m.get("PositionLocation",[])[:3]),description=isolate_untrusted_text(_clean_html(details.get("JobSummary") or "")),apply_url=(m.get("PositionURI") or ""),salary_min=int(float((m.get("PositionRemuneration") or [{}])[0].get("MinimumRange",0) or 0)) or None,salary_max=int(float((m.get("PositionRemuneration") or [{}])[0].get("MaximumRange",0) or 0)) or None,salary_currency="USD",posted_at=_dt(m.get("PublicationStartDate"))))
        return out


class ReedProvider:
    name="reed"
    def __init__(self, settings: Settings): self.s=settings
    def enabled(self): return bool(self.s.reed_api_key)
    def search(self, query: str, location: str = "", limit: int = 20):
        if not self.enabled(): return []
        auth=base64.b64encode(f"{self.s.reed_api_key}:".encode()).decode()
        r=httpx.get("https://www.reed.co.uk/api/1.0/search",headers={"Authorization":f"Basic {auth}"},params={"keywords":query,"locationName":location,"resultsToTake":min(limit,100)},timeout=15.0);r.raise_for_status()
        return [ProviderJob(source=self.name,external_id=str(x.get("jobId")),title=x.get("jobTitle") or "Untitled",company=x.get("employerName") or "Unknown",location=x.get("locationName") or "",description=isolate_untrusted_text(_clean_html(x.get("jobDescription") or "")),apply_url=x.get("jobUrl") or "",salary_min=x.get("minimumSalary"),salary_max=x.get("maximumSalary"),salary_currency="GBP",posted_at=_dt(x.get("date"))) for x in r.json().get("results",[])[:limit]]


class GreenhouseProvider:
    name="greenhouse"
    def __init__(self, board_token: str): self.board_token=board_token
    def enabled(self): return bool(self.board_token)
    def search(self, query: str, location: str = "", limit: int = 20):
        if not self.enabled(): return []
        r=httpx.get(f"https://boards-api.greenhouse.io/v1/boards/{self.board_token}/jobs",params={"content":"true"},timeout=15.0);r.raise_for_status(); out=[]
        q=query.lower()
        for x in r.json().get("jobs",[]):
            if q and q not in (x.get("title") or "").lower() and q not in _clean_html(x.get("content") or "").lower(): continue
            out.append(ProviderJob(source=f"greenhouse:{self.board_token}",external_id=str(x.get("id")),title=x.get("title") or "Untitled",company=self.board_token,location=(x.get("location") or {}).get("name") or "",description=isolate_untrusted_text(_clean_html(x.get("content") or "")),apply_url=x.get("absolute_url") or "",posted_at=_dt(x.get("updated_at"))))
            if len(out)>=limit: break
        return out


class LeverProvider:
    name="lever"
    def __init__(self, company: str): self.company=company
    def enabled(self): return bool(self.company)
    def search(self, query: str, location: str = "", limit: int = 20):
        r=httpx.get(f"https://api.lever.co/v0/postings/{self.company}",params={"mode":"json"},timeout=15.0);r.raise_for_status();out=[];q=query.lower()
        for x in r.json():
            text=" ".join([x.get("text") or "",x.get("descriptionPlain") or "",x.get("additionalPlain") or ""])
            if q and q not in text.lower(): continue
            cats=x.get("categories") or {}
            out.append(ProviderJob(source=f"lever:{self.company}",external_id=str(x.get("id")),title=x.get("text") or "Untitled",company=self.company,location=cats.get("location") or "",description=isolate_untrusted_text(_clean_html(text)),apply_url=x.get("hostedUrl") or x.get("applyUrl") or "",employment_type=cats.get("commitment"),raw_meta={"team":cats.get("team")}))
            if len(out)>=limit: break
        return out


class AshbyProvider:
    name="ashby"
    def __init__(self, board: str): self.board=board
    def enabled(self): return bool(self.board)
    def search(self, query: str, location: str = "", limit: int = 20):
        r=httpx.get(f"https://api.ashbyhq.com/posting-api/job-board/{self.board}",timeout=15.0);r.raise_for_status();out=[];q=query.lower()
        for x in r.json().get("jobs",[]):
            text=" ".join([x.get("title") or "",x.get("descriptionPlain") or ""])
            if q and q not in text.lower(): continue
            out.append(ProviderJob(source=f"ashby:{self.board}",external_id=str(x.get("id") or x.get("jobUrl")),title=x.get("title") or "Untitled",company=self.board,location=x.get("location") or "",description=isolate_untrusted_text(_clean_html(x.get("descriptionPlain") or "")),apply_url=x.get("applyUrl") or x.get("jobUrl") or "",employment_type=x.get("employmentType"),posted_at=_dt(x.get("publishedAt"))))
            if len(out)>=limit: break
        return out


class DevelopmentJobProvider:
    """Deterministic seed adapter for local development only; never used in production."""
    name="development"
    def __init__(self, settings: Settings): self.s=settings
    def enabled(self): return self.s.environment in {"development","test"} and self.s.enable_dev_job_provider
    def search(self, query: str, location: str = "", limit: int = 20):
        if not self.enabled(): return []
        jobs=[
            ProviderJob(source="development",external_id="dev-staff-fe-1",title="Staff Frontend Engineer",company="Northstar Labs",location="Bengaluru · Hybrid",description="Lead React and TypeScript platform work. Improve performance and accessibility, mentor engineers, and partner with GraphQL teams.",requirements={"skills":["React","TypeScript","Accessibility","GraphQL","Performance"],"experience_years":7,"education":"Bachelor's degree or equivalent experience"},apply_url="https://example.invalid/development-only/northstar"),
            ProviderJob(source="development",external_id="dev-product-2",title="Senior Product Engineer",company="Kite Systems",location="Remote",description="Build product experiences with Next.js, TypeScript, PostgreSQL and strong accessibility practices. Collaborate across design and backend teams.",requirements={"skills":["Next.js","TypeScript","PostgreSQL","Accessibility"],"experience_years":5},apply_url="https://example.invalid/development-only/kite"),
            ProviderJob(source="development",external_id="dev-platform-3",title="Frontend Platform Engineer",company="Atlas Grid",location="Hyderabad · Hybrid",description="Own design-system infrastructure, React performance, testing, CI and developer tooling across multiple product teams.",requirements={"skills":["React","Design systems","Testing","CI","Developer tooling"],"experience_years":5},apply_url="https://example.invalid/development-only/atlas"),
        ]
        q=query.lower().strip(); loc=location.lower().strip()
        filtered=[j for j in jobs if (not q or q in (j.title+" "+j.description).lower()) and (not loc or loc in j.location.lower())]
        return filtered[:limit]


def configured_providers(settings: Settings):
    providers=[AdzunaProvider(settings),JoobleProvider(settings),USAJobsProvider(settings),ReedProvider(settings)]
    targets=settings.job_provider_targets
    providers.extend(GreenhouseProvider(x) for x in targets.get("greenhouse",[]))
    providers.extend(LeverProvider(x) for x in targets.get("lever",[]))
    providers.extend(AshbyProvider(x) for x in targets.get("ashby",[]))
    if settings.enable_dev_job_provider and settings.environment in {"development","test"}:
        providers.append(DevelopmentJobProvider(settings))
    return providers
