from __future__ import annotations

import base64
import re
from datetime import UTC, datetime

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
        parsed = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
        return (
            parsed
            if parsed.tzinfo
            else parsed.replace(tzinfo=UTC)
        )
    except ValueError:
        return None


class AdzunaProvider:
    name = "adzuna"

    def __init__(self, settings: Settings):
        self.s = settings

    def enabled(self) -> bool:
        return bool(
            self.s.adzuna_app_id
            and self.s.adzuna_app_key
        )

    def search(
        self,
        query: str,
        location: str = "",
        limit: int = 20,
    ) -> list[ProviderJob]:
        if not self.enabled():
            return []

        country = (
            self.s.adzuna_country
            or "in"
        ).lower()

        url = (
            "https://api.adzuna.com/"
            f"v1/api/jobs/{country}/search/1"
        )

        params = {
            "app_id": self.s.adzuna_app_id,
            "app_key": self.s.adzuna_app_key,
            "what": query,
            "where": location,
            "results_per_page": min(
                max(limit, 1),
                50,
            ),
            "content-type": "application/json",
        }

        response = httpx.get(
            url,
            params=params,
            timeout=15.0,
        )
        response.raise_for_status()

        output: list[ProviderJob] = []

        for item in response.json().get(
            "results",
            [],
        ):
            company = (
                item.get("company")
                or {}
            )
            location_data = (
                item.get("location")
                or {}
            )
            category = (
                item.get("category")
                or {}
            )

            external_id = str(
                item.get("id")
                or item.get("redirect_url")
                or ""
            )

            if not external_id:
                continue

            output.append(
                ProviderJob(
                    source=self.name,
                    external_id=external_id,
                    title=(
                        item.get("title")
                        or "Untitled"
                    ),
                    company=(
                        company.get(
                            "display_name"
                        )
                        or "Unknown"
                    ),
                    location=(
                        location_data.get(
                            "display_name"
                        )
                        or ""
                    ),
                    description=(
                        isolate_untrusted_text(
                            _clean_html(
                                item.get(
                                    "description"
                                )
                                or ""
                            )
                        )
                    ),
                    apply_url=(
                        item.get(
                            "redirect_url"
                        )
                        or ""
                    ),
                    salary_min=(
                        item.get("salary_min")
                    ),
                    salary_max=(
                        item.get("salary_max")
                    ),
                    salary_currency=(
                        "INR"
                        if country == "in"
                        else None
                    ),
                    posted_at=_dt(
                        item.get("created")
                    ),
                    raw_meta={
                        "category": (
                            category.get("label")
                        ),
                        "provider_country": country,
                    },
                )
            )

        return output


class JoobleProvider:
    name = "jooble"

    def __init__(self, settings: Settings):
        self.s = settings

    def enabled(self) -> bool:
        return bool(
            self.s.jooble_api_key
        )

    def search(
        self,
        query: str,
        location: str = "",
        limit: int = 20,
    ) -> list[ProviderJob]:
        if not self.enabled():
            return []

        domain = getattr(
            self.s,
            "jooble_domain",
            "in.jooble.org",
        )

        domain = (
            str(domain)
            .removeprefix("https://")
            .removeprefix("http://")
            .rstrip("/")
        )

        url = (
            f"https://{domain}/api/"
            f"{self.s.jooble_api_key}"
        )

        response = httpx.post(
            url,
            json={
                "keywords": query,
                "location": location,
                "page": 1,
            },
            headers={
                "Content-Type": "application/json",
            },
            timeout=15.0,
        )

        response.raise_for_status()

        output: list[ProviderJob] = []

        for item in response.json().get(
            "jobs",
            [],
        )[:limit]:
            external_id = str(
                item.get("id")
                or item.get("link")
                or ""
            )

            if not external_id:
                continue

            output.append(
                ProviderJob(
                    source=self.name,
                    external_id=external_id,
                    title=(
                        item.get("title")
                        or "Untitled"
                    ),
                    company=(
                        item.get("company")
                        or "Unknown"
                    ),
                    location=(
                        item.get("location")
                        or ""
                    ),
                    description=(
                        isolate_untrusted_text(
                            _clean_html(
                                item.get("snippet")
                                or ""
                            )
                        )
                    ),
                    apply_url=(
                        item.get("link")
                        or ""
                    ),
                    salary_currency=None,
                    employment_type=(
                        item.get("type")
                    ),
                    posted_at=_dt(
                        item.get("updated")
                    ),
                    raw_meta={
                        "salary_text": (
                            item.get("salary")
                        ),
                        "provider_source": (
                            item.get("source")
                        ),
                        "jooble_domain": domain,
                    },
                )
            )

        return output


class USAJobsProvider:
    name = "usajobs"

    def __init__(self, settings: Settings):
        self.s = settings

    def enabled(self) -> bool:
        return bool(
            self.s.usajobs_api_key
            and self.s.usajobs_user_agent_email
        )

    def search(
        self,
        query: str,
        location: str = "",
        limit: int = 20,
    ) -> list[ProviderJob]:
        if not self.enabled():
            return []

        headers = {
            "Authorization-Key": (
                self.s.usajobs_api_key
            ),
            "User-Agent": (
                self.s.usajobs_user_agent_email
            ),
            "Host": "data.usajobs.gov",
        }

        params = {
            "Keyword": query,
            "LocationName": location,
            "ResultsPerPage": min(
                max(limit, 1),
                100,
            ),
        }

        response = httpx.get(
            "https://data.usajobs.gov/api/search",
            headers=headers,
            params=params,
            timeout=15.0,
        )
        response.raise_for_status()

        output: list[ProviderJob] = []

        items = (
            response.json()
            .get("SearchResult", {})
            .get("SearchResultItems", [])
        )

        for item in items:
            descriptor = (
                item.get(
                    "MatchedObjectDescriptor"
                )
                or {}
            )

            details = (
                descriptor.get(
                    "UserArea",
                    {},
                )
                .get(
                    "Details",
                    {},
                )
            )

            remuneration = (
                descriptor.get(
                    "PositionRemuneration"
                )
                or [{}]
            )

            salary = (
                remuneration[0]
                if remuneration
                else {}
            )

            locations = (
                descriptor.get(
                    "PositionLocation"
                )
                or []
            )

            location_text = ", ".join(
                row.get(
                    "LocationName",
                    "",
                )
                for row in locations[:3]
                if row.get(
                    "LocationName"
                )
            )

            external_id = str(
                descriptor.get(
                    "PositionID"
                )
                or descriptor.get(
                    "PositionURI"
                )
                or ""
            )

            if not external_id:
                continue

            try:
                salary_min = (
                    int(
                        float(
                            salary.get(
                                "MinimumRange"
                            )
                            or 0
                        )
                    )
                    or None
                )
            except (
                TypeError,
                ValueError,
            ):
                salary_min = None

            try:
                salary_max = (
                    int(
                        float(
                            salary.get(
                                "MaximumRange"
                            )
                            or 0
                        )
                    )
                    or None
                )
            except (
                TypeError,
                ValueError,
            ):
                salary_max = None

            output.append(
                ProviderJob(
                    source=self.name,
                    external_id=external_id,
                    title=(
                        descriptor.get(
                            "PositionTitle"
                        )
                        or "Untitled"
                    ),
                    company=(
                        descriptor.get(
                            "OrganizationName"
                        )
                        or descriptor.get(
                            "DepartmentName"
                        )
                        or "U.S. Government"
                    ),
                    location=location_text,
                    description=(
                        isolate_untrusted_text(
                            _clean_html(
                                details.get(
                                    "JobSummary"
                                )
                                or ""
                            )
                        )
                    ),
                    apply_url=(
                        descriptor.get(
                            "PositionURI"
                        )
                        or ""
                    ),
                    salary_min=salary_min,
                    salary_max=salary_max,
                    salary_currency="USD",
                    posted_at=_dt(
                        descriptor.get(
                            "PublicationStartDate"
                        )
                    ),
                )
            )

        return output


class ReedProvider:
    name = "reed"

    def __init__(self, settings: Settings):
        self.s = settings

    def enabled(self) -> bool:
        return bool(
            self.s.reed_api_key
        )

    def search(
        self,
        query: str,
        location: str = "",
        limit: int = 20,
    ) -> list[ProviderJob]:
        if not self.enabled():
            return []

        auth = base64.b64encode(
            f"{self.s.reed_api_key}:".encode()
        ).decode()

        response = httpx.get(
            "https://www.reed.co.uk/api/1.0/search",
            headers={
                "Authorization": (
                    f"Basic {auth}"
                )
            },
            params={
                "keywords": query,
                "locationName": location,
                "resultsToTake": min(
                    max(limit, 1),
                    100,
                ),
            },
            timeout=15.0,
        )

        response.raise_for_status()

        output: list[ProviderJob] = []

        for item in response.json().get(
            "results",
            [],
        )[:limit]:
            external_id = str(
                item.get("jobId")
                or item.get("jobUrl")
                or ""
            )

            if not external_id:
                continue

            output.append(
                ProviderJob(
                    source=self.name,
                    external_id=external_id,
                    title=(
                        item.get("jobTitle")
                        or "Untitled"
                    ),
                    company=(
                        item.get("employerName")
                        or "Unknown"
                    ),
                    location=(
                        item.get("locationName")
                        or ""
                    ),
                    description=(
                        isolate_untrusted_text(
                            _clean_html(
                                item.get(
                                    "jobDescription"
                                )
                                or ""
                            )
                        )
                    ),
                    apply_url=(
                        item.get("jobUrl")
                        or ""
                    ),
                    salary_min=(
                        item.get(
                            "minimumSalary"
                        )
                    ),
                    salary_max=(
                        item.get(
                            "maximumSalary"
                        )
                    ),
                    salary_currency="GBP",
                    posted_at=_dt(
                        item.get("date")
                    ),
                )
            )

        return output


class GreenhouseProvider:
    name = "greenhouse"

    def __init__(
        self,
        board_token: str,
    ):
        self.board_token = board_token

    def enabled(self) -> bool:
        return bool(
            self.board_token
        )

    def search(
        self,
        query: str,
        location: str = "",
        limit: int = 20,
    ) -> list[ProviderJob]:
        if not self.enabled():
            return []

        response = httpx.get(
            (
                "https://boards-api.greenhouse.io/"
                f"v1/boards/{self.board_token}/jobs"
            ),
            params={
                "content": "true",
            },
            timeout=15.0,
        )

        response.raise_for_status()

        output: list[ProviderJob] = []
        query_text = (
            query.lower().strip()
        )
        location_text = (
            location.lower().strip()
        )

        for item in response.json().get(
            "jobs",
            [],
        ):
            title = (
                item.get("title")
                or ""
            )

            content = _clean_html(
                item.get("content")
                or ""
            )

            item_location = (
                (
                    item.get("location")
                    or {}
                ).get("name")
                or ""
            )

            searchable = (
                f"{title} {content}"
            ).lower()

            if (
                query_text
                and query_text
                not in searchable
            ):
                continue

            if (
                location_text
                and location_text
                not in item_location.lower()
            ):
                continue

            external_id = str(
                item.get("id")
                or item.get(
                    "absolute_url"
                )
                or ""
            )

            if not external_id:
                continue

            output.append(
                ProviderJob(
                    source=(
                        "greenhouse:"
                        f"{self.board_token}"
                    ),
                    external_id=external_id,
                    title=(
                        title
                        or "Untitled"
                    ),
                    company=self.board_token,
                    location=item_location,
                    description=(
                        isolate_untrusted_text(
                            content
                        )
                    ),
                    apply_url=(
                        item.get(
                            "absolute_url"
                        )
                        or ""
                    ),
                    posted_at=_dt(
                        item.get(
                            "updated_at"
                        )
                    ),
                    raw_meta={
                        "ats": "greenhouse",
                    },
                )
            )

            if len(output) >= limit:
                break

        return output


class LeverProvider:
    name = "lever"

    def __init__(
        self,
        company: str,
    ):
        self.company = company

    def enabled(self) -> bool:
        return bool(
            self.company
        )

    def search(
        self,
        query: str,
        location: str = "",
        limit: int = 20,
    ) -> list[ProviderJob]:
        if not self.enabled():
            return []

        response = httpx.get(
            (
                "https://api.lever.co/"
                f"v0/postings/{self.company}"
            ),
            params={
                "mode": "json",
            },
            timeout=15.0,
        )

        response.raise_for_status()

        output: list[ProviderJob] = []
        query_text = (
            query.lower().strip()
        )
        location_text = (
            location.lower().strip()
        )

        for item in response.json():
            categories = (
                item.get("categories")
                or {}
            )

            item_location = (
                categories.get(
                    "location"
                )
                or ""
            )

            text = " ".join(
                [
                    item.get("text")
                    or "",
                    item.get(
                        "descriptionPlain"
                    )
                    or "",
                    item.get(
                        "additionalPlain"
                    )
                    or "",
                ]
            )

            if (
                query_text
                and query_text
                not in text.lower()
            ):
                continue

            if (
                location_text
                and location_text
                not in item_location.lower()
            ):
                continue

            external_id = str(
                item.get("id")
                or item.get(
                    "hostedUrl"
                )
                or item.get(
                    "applyUrl"
                )
                or ""
            )

            if not external_id:
                continue

            output.append(
                ProviderJob(
                    source=(
                        f"lever:{self.company}"
                    ),
                    external_id=external_id,
                    title=(
                        item.get("text")
                        or "Untitled"
                    ),
                    company=self.company,
                    location=item_location,
                    description=(
                        isolate_untrusted_text(
                            _clean_html(text)
                        )
                    ),
                    apply_url=(
                        item.get(
                            "hostedUrl"
                        )
                        or item.get(
                            "applyUrl"
                        )
                        or ""
                    ),
                    employment_type=(
                        categories.get(
                            "commitment"
                        )
                    ),
                    raw_meta={
                        "team": (
                            categories.get(
                                "team"
                            )
                        ),
                        "ats": "lever",
                    },
                )
            )

            if len(output) >= limit:
                break

        return output


class AshbyProvider:
    name = "ashby"

    def __init__(
        self,
        board: str,
    ):
        self.board = board

    def enabled(self) -> bool:
        return bool(
            self.board
        )

    def search(
        self,
        query: str,
        location: str = "",
        limit: int = 20,
    ) -> list[ProviderJob]:
        if not self.enabled():
            return []

        response = httpx.get(
            (
                "https://api.ashbyhq.com/"
                f"posting-api/job-board/{self.board}"
            ),
            timeout=15.0,
        )

        response.raise_for_status()

        output: list[ProviderJob] = []
        query_text = (
            query.lower().strip()
        )
        location_text = (
            location.lower().strip()
        )

        for item in response.json().get(
            "jobs",
            [],
        ):
            title = (
                item.get("title")
                or ""
            )
            description = (
                item.get(
                    "descriptionPlain"
                )
                or ""
            )
            item_location = (
                item.get("location")
                or ""
            )

            searchable = (
                f"{title} {description}"
            ).lower()

            if (
                query_text
                and query_text
                not in searchable
            ):
                continue

            if (
                location_text
                and location_text
                not in item_location.lower()
            ):
                continue

            external_id = str(
                item.get("id")
                or item.get("jobUrl")
                or ""
            )

            if not external_id:
                continue

            output.append(
                ProviderJob(
                    source=(
                        f"ashby:{self.board}"
                    ),
                    external_id=external_id,
                    title=(
                        title
                        or "Untitled"
                    ),
                    company=self.board,
                    location=item_location,
                    description=(
                        isolate_untrusted_text(
                            _clean_html(
                                description
                            )
                        )
                    ),
                    apply_url=(
                        item.get("applyUrl")
                        or item.get("jobUrl")
                        or ""
                    ),
                    employment_type=(
                        item.get(
                            "employmentType"
                        )
                    ),
                    posted_at=_dt(
                        item.get(
                            "publishedAt"
                        )
                    ),
                    raw_meta={
                        "ats": "ashby",
                    },
                )
            )

            if len(output) >= limit:
                break

        return output


class DevelopmentJobProvider:
    """
    Deterministic seed provider for local
    development and tests only.
    """

    name = "development"

    def __init__(
        self,
        settings: Settings,
    ):
        self.s = settings

    def enabled(self) -> bool:
        return (
            self.s.environment
            in {
                "development",
                "test",
            }
            and self.s.enable_dev_job_provider
        )

    def search(
        self,
        query: str,
        location: str = "",
        limit: int = 20,
    ) -> list[ProviderJob]:
        if not self.enabled():
            return []

        jobs = [
            ProviderJob(
                source="development",
                external_id="dev-staff-fe-1",
                title=(
                    "Staff Frontend Engineer"
                ),
                company="Northstar Labs",
                location=(
                    "Bengaluru · Hybrid"
                ),
                description=(
                    "Lead React and TypeScript "
                    "platform work. Improve "
                    "performance and accessibility, "
                    "mentor engineers, and partner "
                    "with GraphQL teams."
                ),
                requirements={
                    "skills": [
                        "React",
                        "TypeScript",
                        "Accessibility",
                        "GraphQL",
                        "Performance",
                    ],
                    "experience_years": 7,
                    "education": (
                        "Bachelor's degree or "
                        "equivalent experience"
                    ),
                },
                apply_url=(
                    "https://example.invalid/"
                    "development-only/northstar"
                ),
            ),
            ProviderJob(
                source="development",
                external_id="dev-product-2",
                title=(
                    "Senior Product Engineer"
                ),
                company="Kite Systems",
                location="Remote",
                description=(
                    "Build product experiences "
                    "with Next.js, TypeScript, "
                    "PostgreSQL and strong "
                    "accessibility practices. "
                    "Collaborate across design "
                    "and backend teams."
                ),
                requirements={
                    "skills": [
                        "Next.js",
                        "TypeScript",
                        "PostgreSQL",
                        "Accessibility",
                    ],
                    "experience_years": 5,
                },
                apply_url=(
                    "https://example.invalid/"
                    "development-only/kite"
                ),
            ),
            ProviderJob(
                source="development",
                external_id=(
                    "dev-platform-3"
                ),
                title=(
                    "Frontend Platform Engineer"
                ),
                company="Atlas Grid",
                location=(
                    "Hyderabad · Hybrid"
                ),
                description=(
                    "Own design-system "
                    "infrastructure, React "
                    "performance, testing, CI "
                    "and developer tooling across "
                    "multiple product teams."
                ),
                requirements={
                    "skills": [
                        "React",
                        "Design systems",
                        "Testing",
                        "CI",
                        "Developer tooling",
                    ],
                    "experience_years": 5,
                },
                apply_url=(
                    "https://example.invalid/"
                    "development-only/atlas"
                ),
            ),
            ProviderJob(
                source="development",
                external_id=(
                    "dev-python-kochi-4"
                ),
                title=(
                    "Python Backend Developer"
                ),
                company="Malabar Digital",
                location="Kochi · Hybrid",
                description=(
                    "Build Python and FastAPI "
                    "backend services, PostgreSQL "
                    "data models, REST APIs and "
                    "cloud integrations."
                ),
                requirements={
                    "skills": [
                        "Python",
                        "FastAPI",
                        "PostgreSQL",
                        "REST APIs",
                    ],
                    "experience_years": 3,
                },
                apply_url=(
                    "https://example.invalid/"
                    "development-only/"
                    "python-kochi"
                ),
            ),
            ProviderJob(
                source="development",
                external_id=(
                    "dev-ml-bengaluru-5"
                ),
                title=(
                    "Machine Learning Engineer"
                ),
                company="Indigo AI Systems",
                location=(
                    "Bengaluru · Hybrid"
                ),
                description=(
                    "Develop Python machine "
                    "learning systems, model "
                    "pipelines, APIs and production "
                    "ML infrastructure."
                ),
                requirements={
                    "skills": [
                        "Python",
                        "Machine Learning",
                        "SQL",
                        "Docker",
                    ],
                    "experience_years": 3,
                },
                apply_url=(
                    "https://example.invalid/"
                    "development-only/"
                    "ml-bengaluru"
                ),
            ),
        ]

        query_text = (
            query.lower().strip()
        )
        location_text = (
            location.lower().strip()
        )

        filtered = [
            job
            for job in jobs
            if (
                not query_text
                or query_text
                in (
                    job.title
                    + " "
                    + job.description
                ).lower()
            )
            and (
                not location_text
                or location_text
                in job.location.lower()
                or job.location.lower()
                == "remote"
            )
        ]

        return filtered[:limit]


def configured_providers(
    settings: Settings,
):
    providers = [
        AdzunaProvider(settings),
        JoobleProvider(settings),
        USAJobsProvider(settings),
        ReedProvider(settings),
    ]

    targets = (
        settings.job_provider_targets
    )

    providers.extend(
        GreenhouseProvider(
            board_token
        )
        for board_token in targets.get(
            "greenhouse",
            [],
        )
    )

    providers.extend(
        LeverProvider(company)
        for company in targets.get(
            "lever",
            [],
        )
    )

    providers.extend(
        AshbyProvider(board)
        for board in targets.get(
            "ashby",
            [],
        )
    )

    if (
        settings.enable_dev_job_provider
        and settings.environment
        in {
            "development",
            "test",
        }
    ):
        providers.append(
            DevelopmentJobProvider(
                settings
            )
        )

    return providers
