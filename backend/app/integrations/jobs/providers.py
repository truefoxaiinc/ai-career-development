from __future__ import annotations

import base64
import re
from datetime import UTC, datetime
from typing import Any

import httpx

from app.ai.grounding import isolate_untrusted_text
from app.core.config import Settings
from .base import ProviderJob


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------

_COUNTRIES: dict[str, tuple[str, str | None]] = {
    "US": ("United States", "USD"),
    "CA": ("Canada", "CAD"),
    "IN": ("India", "INR"),
    "GB": ("United Kingdom", "GBP"),
    "IE": ("Ireland", "EUR"),
    "DE": ("Germany", "EUR"),
    "FR": ("France", "EUR"),
    "NL": ("Netherlands", "EUR"),
    "BE": ("Belgium", "EUR"),
    "AT": ("Austria", "EUR"),
    "ES": ("Spain", "EUR"),
    "IT": ("Italy", "EUR"),
    "PT": ("Portugal", "EUR"),
    "FI": ("Finland", "EUR"),
    "GR": ("Greece", "EUR"),
    "LU": ("Luxembourg", "EUR"),
    "MT": ("Malta", "EUR"),
    "CY": ("Cyprus", "EUR"),
    "EE": ("Estonia", "EUR"),
    "LV": ("Latvia", "EUR"),
    "LT": ("Lithuania", "EUR"),
    "SI": ("Slovenia", "EUR"),
    "SK": ("Slovakia", "EUR"),
    "HR": ("Croatia", "EUR"),
    "CH": ("Switzerland", "CHF"),
    "SE": ("Sweden", "SEK"),
    "NO": ("Norway", "NOK"),
    "DK": ("Denmark", "DKK"),
    "PL": ("Poland", "PLN"),
    "CZ": ("Czechia", "CZK"),
    "HU": ("Hungary", "HUF"),
    "RO": ("Romania", "RON"),
    "BG": ("Bulgaria", "BGN"),
    "SG": ("Singapore", "SGD"),
    "AE": ("United Arab Emirates", "AED"),
    "JP": ("Japan", "JPY"),
    "KR": ("South Korea", "KRW"),
    "HK": ("Hong Kong", "HKD"),
    "TW": ("Taiwan", "TWD"),
    "MY": ("Malaysia", "MYR"),
    "PH": ("Philippines", "PHP"),
    "ID": ("Indonesia", "IDR"),
    "TH": ("Thailand", "THB"),
    "VN": ("Vietnam", "VND"),
    "PK": ("Pakistan", "PKR"),
    "BD": ("Bangladesh", "BDT"),
    "LK": ("Sri Lanka", "LKR"),
    "NP": ("Nepal", "NPR"),
    "CN": ("China", "CNY"),
    "AU": ("Australia", "AUD"),
    "NZ": ("New Zealand", "NZD"),
}

_COUNTRY_ALIASES: dict[str, str] = {
    "united states": "US",
    "united states of america": "US",
    "u.s.": "US",
    "u.s.a.": "US",
    "usa": "US",
    "canada": "CA",
    "india": "IN",
    "united kingdom": "GB",
    "uk": "GB",
    "u.k.": "GB",
    "great britain": "GB",
    "england": "GB",
    "scotland": "GB",
    "wales": "GB",
    "northern ireland": "GB",
    "ireland": "IE",
    "germany": "DE",
    "france": "FR",
    "netherlands": "NL",
    "belgium": "BE",
    "austria": "AT",
    "spain": "ES",
    "italy": "IT",
    "portugal": "PT",
    "finland": "FI",
    "greece": "GR",
    "luxembourg": "LU",
    "malta": "MT",
    "cyprus": "CY",
    "estonia": "EE",
    "latvia": "LV",
    "lithuania": "LT",
    "slovenia": "SI",
    "slovakia": "SK",
    "croatia": "HR",
    "switzerland": "CH",
    "sweden": "SE",
    "norway": "NO",
    "denmark": "DK",
    "poland": "PL",
    "czechia": "CZ",
    "czech republic": "CZ",
    "hungary": "HU",
    "romania": "RO",
    "bulgaria": "BG",
    "singapore": "SG",
    "united arab emirates": "AE",
    "uae": "AE",
    "dubai": "AE",
    "abu dhabi": "AE",
    "japan": "JP",
    "south korea": "KR",
    "republic of korea": "KR",
    "hong kong": "HK",
    "taiwan": "TW",
    "malaysia": "MY",
    "philippines": "PH",
    "indonesia": "ID",
    "thailand": "TH",
    "vietnam": "VN",
    "pakistan": "PK",
    "bangladesh": "BD",
    "sri lanka": "LK",
    "nepal": "NP",
    "china": "CN",
    "australia": "AU",
    "new zealand": "NZ",
}

# Adzuna endpoint codes are not identical to ISO codes in every case.
_ADZUNA_CODES: dict[str, str] = {
    "US": "us",
    "CA": "ca",
    "IN": "in",
    "GB": "gb",
    "DE": "de",
    "FR": "fr",
    "NL": "nl",
    "PL": "pl",
    "AU": "au",
    "NZ": "nz",
    "SG": "sg",
    "ZA": "za",
    "BR": "br",
}


def _clean_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", text).strip()


def _clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


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


def _to_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _country_details(
    country_code: str | None,
) -> tuple[str, str | None, str | None]:
    if not country_code:
        return "", None, None

    code = country_code.strip().upper()
    details = _COUNTRIES.get(code)

    if not details:
        return "", code[:2] or None, None

    country, currency = details
    return country, code, currency


def _country_code_from_text(
    value: str | None,
) -> str | None:
    text = _clean_text(value).casefold()

    if not text:
        return None

    # Prefer longer names first so aliases such as "united kingdom" win
    # before shorter tokens such as "uk".
    for alias in sorted(
        _COUNTRY_ALIASES,
        key=len,
        reverse=True,
    ):
        if re.search(
            rf"(?<!\w){re.escape(alias)}(?!\w)",
            text,
            re.IGNORECASE,
        ):
            return _COUNTRY_ALIASES[alias]

    return None


def _country_from_text(
    value: str | None,
) -> tuple[str, str | None, str | None]:
    return _country_details(
        _country_code_from_text(value)
    )


def _provider_country_from_domain(
    domain: str,
) -> str | None:
    host = (
        domain.strip()
        .lower()
        .removeprefix("https://")
        .removeprefix("http://")
        .split("/", 1)[0]
    )

    first = host.split(".", 1)[0]

    if first == "uk":
        return "GB"

    if len(first) == 2:
        code = first.upper()
        if code in _COUNTRIES:
            return code

    return None


def _city_from_location(
    location: str | None,
    country: str = "",
) -> str | None:
    text = _clean_text(location)

    if not text:
        return None

    low = text.casefold()
    if low in {
        "remote",
        "worldwide",
        "global",
        "anywhere",
    }:
        return None

    # Remove work-mode words before choosing the first locality segment.
    cleaned = re.sub(
        r"\b(?:remote|hybrid|on[- ]?site|onsite)\b",
        " ",
        text,
        flags=re.IGNORECASE,
    )

    parts = [
        _clean_text(part)
        for part in re.split(
            r"\s*[·|/]\s*|\s*,\s*",
            cleaned,
        )
        if _clean_text(part)
    ]

    if not parts:
        return None

    for part in parts:
        if country and part.casefold() == country.casefold():
            continue
        if _country_code_from_text(part):
            continue
        return part[:160]

    return None


def _remote_mode(
    location: str | None,
    description: str | None = None,
    explicit: Any = None,
) -> str | None:
    explicit_text = _clean_text(explicit).casefold()
    combined = " ".join(
        part
        for part in [
            explicit_text,
            _clean_text(location).casefold(),
        ]
        if part
    )

    if re.search(r"\bhybrid\b", combined):
        return "hybrid"

    if re.search(
        r"\b(?:remote|work from home|wfh)\b",
        combined,
    ):
        return "remote"

    if re.search(
        r"\b(?:on[- ]?site|onsite|in[- ]?office|office based)\b",
        combined,
    ):
        return "onsite"

    # Description is used only for strong, explicit phrases. This avoids
    # treating incidental mentions of remote collaboration as work mode.
    description_text = _clean_text(description).casefold()

    if re.search(
        r"\b(?:fully remote|100% remote|remote position|remote role)\b",
        description_text,
    ):
        return "remote"

    if re.search(
        r"\b(?:hybrid position|hybrid role|hybrid work)\b",
        description_text,
    ):
        return "hybrid"

    if re.search(
        r"\b(?:on[- ]?site position|onsite role|in[- ]?office role)\b",
        description_text,
    ):
        return "onsite"

    return None


def _employment_type(value: Any) -> str | None:
    text = _clean_text(value)

    if not text:
        return None

    low = text.casefold().replace("_", " ")

    if "full time" in low or "full-time" in low:
        return "full-time"
    if "part time" in low or "part-time" in low:
        return "part-time"
    if "intern" in low:
        return "internship"
    if "apprentice" in low:
        return "apprenticeship"
    if "contract" in low:
        return "contract"
    if "temporary" in low or "temp" == low:
        return "temporary"
    if "permanent" in low:
        return "permanent"

    return text[:120]


def _visa_sponsorship_from_text(
    value: str | None,
) -> bool | None:
    text = _clean_text(value).casefold()

    if not text:
        return None

    negative = [
        r"\bno visa sponsorship\b",
        r"\bvisa sponsorship (?:is )?not available\b",
        r"\bdo(?:es)? not (?:offer|provide) visa sponsorship\b",
        r"\bwill not sponsor\b",
        r"\bunable to sponsor\b",
        r"\bwithout (?:current or future )?sponsorship\b",
        r"\bnot eligible for sponsorship\b",
    ]

    if any(re.search(pattern, text) for pattern in negative):
        return False

    positive = [
        r"\bvisa sponsorship (?:is )?(?:available|provided|offered)\b",
        r"\b(?:offer|provide)s? visa sponsorship\b",
        r"\bwill sponsor\b",
        r"\bsponsorship available\b",
        r"\bwork visa sponsorship\b",
    ]

    if any(re.search(pattern, text) for pattern in positive):
        return True

    return None


def _relocation_support_from_text(
    value: str | None,
) -> bool | None:
    text = _clean_text(value).casefold()

    if not text:
        return None

    negative = [
        r"\bno relocation (?:assistance|support)\b",
        r"\brelocation (?:assistance|support) (?:is )?not available\b",
        r"\brelocation not provided\b",
    ]

    if any(re.search(pattern, text) for pattern in negative):
        return False

    positive = [
        r"\brelocation (?:assistance|support) (?:is )?(?:available|provided|offered)\b",
        r"\b(?:offer|provide)s? relocation (?:assistance|support)\b",
        r"\brelocation package\b",
    ]

    if any(re.search(pattern, text) for pattern in positive):
        return True

    return None


def _work_authorization_from_text(
    value: str | None,
) -> str | None:
    text = _clean_text(value)

    if not text:
        return None

    sentences = re.split(r"(?<=[.!?;])\s+", text)

    patterns = (
        "work authorization",
        "authorized to work",
        "authorised to work",
        "right to work",
        "work permit",
        "citizenship required",
        "citizen required",
    )

    for sentence in sentences:
        low = sentence.casefold()
        if any(pattern in low for pattern in patterns):
            return sentence[:250]

    return None


def _first_named_value(value: Any) -> str | None:
    if isinstance(value, str):
        cleaned = _clean_text(value)
        return cleaned or None

    if isinstance(value, dict):
        for key in (
            "name",
            "label",
            "value",
            "display_name",
        ):
            cleaned = _clean_text(value.get(key))
            if cleaned:
                return cleaned
        return None

    if isinstance(value, list):
        for item in value:
            found = _first_named_value(item)
            if found:
                return found

    return None


def _greenhouse_metadata_value(
    item: dict[str, Any],
    wanted: str,
) -> str | None:
    for row in item.get("metadata") or []:
        if not isinstance(row, dict):
            continue

        name = _clean_text(row.get("name"))
        if name.casefold() != wanted.casefold():
            continue

        return _first_named_value(row.get("value"))

    return None


def _normalized_common_fields(
    *,
    title: str,
    location: str,
    description: str,
    country_code: str | None = None,
    country: str = "",
    city: str | None = None,
    category: str | None = None,
    remote_mode: Any = None,
    employment_type: Any = None,
) -> dict[str, Any]:
    inferred_country, inferred_code, _ = _country_from_text(location)

    normalized_country = country or inferred_country
    normalized_code = country_code or inferred_code

    if normalized_code and not normalized_country:
        normalized_country, normalized_code, _ = _country_details(
            normalized_code
        )

    return {
        "country": normalized_country,
        "country_code": (
            normalized_code.upper()
            if normalized_code
            else None
        ),
        "city": city or _city_from_location(
            location,
            normalized_country,
        ),
        "category": _clean_text(category) or None,
        "occupation": _clean_text(title) or None,
        "remote_mode": _remote_mode(
            location,
            description,
            remote_mode,
        ),
        "employment_type": _employment_type(
            employment_type
        ),
        "visa_sponsorship": _visa_sponsorship_from_text(
            description
        ),
        "relocation_support": _relocation_support_from_text(
            description
        ),
        "work_authorization": _work_authorization_from_text(
            description
        ),
    }


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------


class AdzunaProvider:
    name = "adzuna"

    def __init__(self, settings: Settings):
        self.s = settings

    def enabled(self) -> bool:
        return bool(
            self.s.adzuna_app_id
            and self.s.adzuna_app_key
        )

    def _country_for_search(
        self,
        location: str,
    ) -> tuple[str, str]:
        requested_code = _country_code_from_text(location)

        if requested_code in _ADZUNA_CODES:
            return (
                requested_code,
                _ADZUNA_CODES[requested_code],
            )

        configured = (
            self.s.adzuna_country
            or "in"
        ).strip().lower()

        # Convert a configured ISO GB/IN/etc code into our canonical form.
        canonical = configured.upper()
        if canonical == "UK":
            canonical = "GB"

        if canonical in _COUNTRIES:
            return canonical, _ADZUNA_CODES.get(
                canonical,
                configured,
            )

        return configured.upper()[:2], configured

    def search(
        self,
        query: str,
        location: str = "",
        limit: int = 20,
    ) -> list[ProviderJob]:
        if not self.enabled():
            return []

        country_code, adzuna_country = (
            self._country_for_search(location)
        )

        country, canonical_code, currency = (
            _country_details(country_code)
        )

        url = (
            "https://api.adzuna.com/"
            f"v1/api/jobs/{adzuna_country}/search/1"
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
            company = item.get("company") or {}
            location_data = item.get("location") or {}
            category_data = item.get("category") or {}

            external_id = str(
                item.get("id")
                or item.get("redirect_url")
                or ""
            )

            if not external_id:
                continue

            title = _clean_text(
                item.get("title")
                or "Untitled"
            )
            location_text = _clean_text(
                location_data.get("display_name")
            )
            description = isolate_untrusted_text(
                _clean_html(
                    item.get("description")
                    or ""
                )
            )
            category = _clean_text(
                category_data.get("label")
            ) or None

            area = location_data.get("area") or []
            area_city = None
            if isinstance(area, list):
                for candidate in reversed(area):
                    candidate_text = _clean_text(candidate)
                    if not candidate_text:
                        continue
                    if country and candidate_text.casefold() == country.casefold():
                        continue
                    if _country_code_from_text(candidate_text):
                        continue
                    area_city = candidate_text
                    break

            common = _normalized_common_fields(
                title=title,
                location=location_text,
                description=description,
                country_code=canonical_code,
                country=country,
                city=area_city,
                category=category,
                employment_type=(
                    item.get("contract_time")
                    or item.get("contract_type")
                ),
            )

            output.append(
                ProviderJob(
                    source=self.name,
                    external_id=external_id,
                    title=title,
                    company=(
                        _clean_text(
                            company.get("display_name")
                        )
                        or "Unknown"
                    ),
                    location=location_text,
                    description=description,
                    apply_url=_clean_text(
                        item.get("redirect_url")
                    ),
                    salary_min=_to_int(
                        item.get("salary_min")
                    ),
                    salary_max=_to_int(
                        item.get("salary_max")
                    ),
                    salary_currency=currency,
                    posted_at=_dt(
                        item.get("created")
                    ),
                    raw_meta={
                        "category": category,
                        "provider_country": (
                            canonical_code
                            or country_code
                        ),
                        "provider_country_endpoint": (
                            adzuna_country
                        ),
                    },
                    **common,
                )
            )

        return output


class JoobleProvider:
    name = "jooble"

    def __init__(self, settings: Settings):
        self.s = settings

    def enabled(self) -> bool:
        return bool(self.s.jooble_api_key)

    def _domain_for_search(
        self,
        location: str,
    ) -> str:
        default_domain = (
            str(self.s.jooble_domain)
            .removeprefix("https://")
            .removeprefix("http://")
            .rstrip("/")
        )

        requested_code = _country_code_from_text(location)
        configured_domains = getattr(
            self.s,
            "jooble_country_domains",
            {},
        )

        if requested_code and requested_code in configured_domains:
            return configured_domains[requested_code]

        return default_domain

    def search(
        self,
        query: str,
        location: str = "",
        limit: int = 20,
    ) -> list[ProviderJob]:
        if not self.enabled():
            return []

        domain = self._domain_for_search(location)

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

        country_code = (
            _country_code_from_text(location)
            or _provider_country_from_domain(domain)
        )
        country, country_code, currency = (
            _country_details(country_code)
        )

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

            title = _clean_text(
                item.get("title")
                or "Untitled"
            )
            location_text = _clean_text(
                item.get("location")
            )
            description = isolate_untrusted_text(
                _clean_html(
                    item.get("snippet")
                    or ""
                )
            )

            common = _normalized_common_fields(
                title=title,
                location=location_text,
                description=description,
                country_code=country_code,
                country=country,
                employment_type=item.get("type"),
            )

            output.append(
                ProviderJob(
                    source=self.name,
                    external_id=external_id,
                    title=title,
                    company=(
                        _clean_text(item.get("company"))
                        or "Unknown"
                    ),
                    location=location_text,
                    description=description,
                    apply_url=_clean_text(
                        item.get("link")
                    ),
                    salary_currency=currency,
                    posted_at=_dt(
                        item.get("updated")
                    ),
                    raw_meta={
                        "salary_text": item.get("salary"),
                        "provider_source": item.get("source"),
                        "jooble_domain": domain,
                        "provider_country": country_code,
                    },
                    **common,
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
            "Authorization-Key": self.s.usajobs_api_key,
            "User-Agent": self.s.usajobs_user_agent_email,
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
                item.get("MatchedObjectDescriptor")
                or {}
            )

            details = (
                descriptor.get("UserArea", {})
                .get("Details", {})
            )

            remuneration = (
                descriptor.get("PositionRemuneration")
                or [{}]
            )
            salary = remuneration[0] if remuneration else {}

            locations = (
                descriptor.get("PositionLocation")
                or []
            )

            location_text = ", ".join(
                row.get("LocationName", "")
                for row in locations[:3]
                if row.get("LocationName")
            )

            external_id = str(
                descriptor.get("PositionID")
                or descriptor.get("PositionURI")
                or ""
            )

            if not external_id:
                continue

            title = _clean_text(
                descriptor.get("PositionTitle")
                or "Untitled"
            )
            description = isolate_untrusted_text(
                _clean_html(
                    details.get("JobSummary")
                    or ""
                )
            )

            category = _first_named_value(
                descriptor.get("JobCategory")
            )

            city = None
            for row in locations:
                if not isinstance(row, dict):
                    continue
                city = _clean_text(
                    row.get("CityName")
                ) or None
                if city:
                    break

            schedule = _first_named_value(
                descriptor.get("PositionSchedule")
            )
            offering = _first_named_value(
                descriptor.get("PositionOfferingType")
            )

            work_authorization = _first_named_value(
                details.get("WhoMayApply")
            ) or _work_authorization_from_text(
                description
            )

            common = _normalized_common_fields(
                title=title,
                location=location_text,
                description=description,
                country_code="US",
                country="United States",
                city=city,
                category=category,
                employment_type=(
                    schedule
                    or offering
                ),
            )
            common["work_authorization"] = (
                work_authorization
            )

            output.append(
                ProviderJob(
                    source=self.name,
                    external_id=external_id,
                    title=title,
                    company=(
                        _clean_text(
                            descriptor.get("OrganizationName")
                        )
                        or _clean_text(
                            descriptor.get("DepartmentName")
                        )
                        or "U.S. Government"
                    ),
                    location=location_text,
                    description=description,
                    apply_url=_clean_text(
                        descriptor.get("PositionURI")
                    ),
                    salary_min=_to_int(
                        salary.get("MinimumRange")
                    ),
                    salary_max=_to_int(
                        salary.get("MaximumRange")
                    ),
                    salary_currency="USD",
                    posted_at=_dt(
                        descriptor.get(
                            "PublicationStartDate"
                        )
                    ),
                    raw_meta={
                        "position_schedule": schedule,
                        "position_offering_type": offering,
                    },
                    **common,
                )
            )

        return output


class ReedProvider:
    name = "reed"

    def __init__(self, settings: Settings):
        self.s = settings

    def enabled(self) -> bool:
        return bool(self.s.reed_api_key)

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
                "Authorization": f"Basic {auth}"
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

            title = _clean_text(
                item.get("jobTitle")
                or "Untitled"
            )
            location_text = _clean_text(
                item.get("locationName")
            )
            description = isolate_untrusted_text(
                _clean_html(
                    item.get("jobDescription")
                    or ""
                )
            )

            employment = (
                item.get("contractType")
                or (
                    "full-time"
                    if item.get("fullTime") is True
                    else None
                )
                or (
                    "part-time"
                    if item.get("partTime") is True
                    else None
                )
            )

            common = _normalized_common_fields(
                title=title,
                location=location_text,
                description=description,
                country_code="GB",
                country="United Kingdom",
                employment_type=employment,
            )

            output.append(
                ProviderJob(
                    source=self.name,
                    external_id=external_id,
                    title=title,
                    company=(
                        _clean_text(
                            item.get("employerName")
                        )
                        or "Unknown"
                    ),
                    location=location_text,
                    description=description,
                    apply_url=_clean_text(
                        item.get("jobUrl")
                    ),
                    salary_min=_to_int(
                        item.get("minimumSalary")
                    ),
                    salary_max=_to_int(
                        item.get("maximumSalary")
                    ),
                    salary_currency="GBP",
                    posted_at=_dt(
                        item.get("date")
                    ),
                    **common,
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
        return bool(self.board_token)

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
            params={"content": "true"},
            timeout=15.0,
        )

        response.raise_for_status()

        output: list[ProviderJob] = []
        query_text = query.lower().strip()
        location_text = location.lower().strip()

        for item in response.json().get(
            "jobs",
            [],
        ):
            title = _clean_text(
                item.get("title")
            )
            content = _clean_html(
                item.get("content")
                or ""
            )
            item_location = _clean_text(
                (item.get("location") or {}).get("name")
            )

            searchable = f"{title} {content}".lower()

            if (
                query_text
                and query_text not in searchable
            ):
                continue

            if (
                location_text
                and location_text not in item_location.lower()
            ):
                continue

            external_id = str(
                item.get("id")
                or item.get("absolute_url")
                or ""
            )

            if not external_id:
                continue

            description = isolate_untrusted_text(
                content
            )

            category = _first_named_value(
                item.get("departments")
            )

            explicit_workplace = (
                _greenhouse_metadata_value(
                    item,
                    "Workplace Type",
                )
                or _greenhouse_metadata_value(
                    item,
                    "Work Location",
                )
            )

            employment = _greenhouse_metadata_value(
                item,
                "Employment Type",
            )

            common = _normalized_common_fields(
                title=title or "Untitled",
                location=item_location,
                description=description,
                category=category,
                remote_mode=explicit_workplace,
                employment_type=employment,
            )

            output.append(
                ProviderJob(
                    source=(
                        "greenhouse:"
                        f"{self.board_token}"
                    ),
                    external_id=external_id,
                    title=title or "Untitled",
                    company=self.board_token,
                    location=item_location,
                    description=description,
                    apply_url=_clean_text(
                        item.get("absolute_url")
                    ),
                    posted_at=_dt(
                        item.get("updated_at")
                    ),
                    raw_meta={
                        "ats": "greenhouse",
                    },
                    **common,
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
        return bool(self.company)

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
            params={"mode": "json"},
            timeout=15.0,
        )

        response.raise_for_status()

        output: list[ProviderJob] = []
        query_text = query.lower().strip()
        location_text = location.lower().strip()

        for item in response.json():
            categories = item.get("categories") or {}

            item_location = _clean_text(
                categories.get("location")
            )

            text = " ".join(
                [
                    item.get("text") or "",
                    item.get("descriptionPlain") or "",
                    item.get("additionalPlain") or "",
                ]
            )

            if (
                query_text
                and query_text not in text.lower()
            ):
                continue

            if (
                location_text
                and location_text not in item_location.lower()
            ):
                continue

            external_id = str(
                item.get("id")
                or item.get("hostedUrl")
                or item.get("applyUrl")
                or ""
            )

            if not external_id:
                continue

            title = _clean_text(
                item.get("text")
                or "Untitled"
            )
            description = isolate_untrusted_text(
                _clean_html(text)
            )

            category = _clean_text(
                categories.get("department")
                or categories.get("team")
            ) or None

            common = _normalized_common_fields(
                title=title,
                location=item_location,
                description=description,
                category=category,
                remote_mode=(
                    item.get("workplaceType")
                    or categories.get("workplaceType")
                ),
                employment_type=categories.get(
                    "commitment"
                ),
            )

            output.append(
                ProviderJob(
                    source=f"lever:{self.company}",
                    external_id=external_id,
                    title=title,
                    company=self.company,
                    location=item_location,
                    description=description,
                    apply_url=_clean_text(
                        item.get("hostedUrl")
                        or item.get("applyUrl")
                    ),
                    raw_meta={
                        "team": categories.get("team"),
                        "department": categories.get(
                            "department"
                        ),
                        "ats": "lever",
                    },
                    **common,
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
        return bool(self.board)

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
        query_text = query.lower().strip()
        location_text = location.lower().strip()

        for item in response.json().get(
            "jobs",
            [],
        ):
            title = _clean_text(
                item.get("title")
            )
            description_plain = _clean_text(
                item.get("descriptionPlain")
            )
            item_location = _clean_text(
                item.get("location")
            )

            searchable = (
                f"{title} {description_plain}"
            ).lower()

            if (
                query_text
                and query_text not in searchable
            ):
                continue

            if (
                location_text
                and location_text not in item_location.lower()
            ):
                continue

            external_id = str(
                item.get("id")
                or item.get("jobUrl")
                or ""
            )

            if not external_id:
                continue

            description = isolate_untrusted_text(
                _clean_html(description_plain)
            )

            category = _first_named_value(
                item.get("department")
            ) or _first_named_value(
                item.get("team")
            )

            common = _normalized_common_fields(
                title=title or "Untitled",
                location=item_location,
                description=description,
                category=category,
                remote_mode=(
                    item.get("workplaceType")
                    or (
                        "remote"
                        if item.get("isRemote") is True
                        else None
                    )
                ),
                employment_type=item.get(
                    "employmentType"
                ),
            )

            output.append(
                ProviderJob(
                    source=f"ashby:{self.board}",
                    external_id=external_id,
                    title=title or "Untitled",
                    company=self.board,
                    location=item_location,
                    description=description,
                    apply_url=_clean_text(
                        item.get("applyUrl")
                        or item.get("jobUrl")
                    ),
                    posted_at=_dt(
                        item.get("publishedAt")
                    ),
                    raw_meta={
                        "ats": "ashby",
                    },
                    **common,
                )
            )

            if len(output) >= limit:
                break

        return output


class DevelopmentJobProvider:
    """
    Deterministic multi-industry seed provider for local development and
    automated tests only. These records are intentionally diverse so the
    global filters can be exercised without external provider credentials.
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
                title="Staff Frontend Engineer",
                company="Northstar Labs",
                location="Bengaluru, India · Hybrid",
                country="India",
                country_code="IN",
                city="Bengaluru",
                category="Technology",
                occupation="Frontend Engineer",
                remote_mode="hybrid",
                employment_type="full-time",
                description=(
                    "Lead React and TypeScript platform work. Improve "
                    "performance and accessibility, mentor engineers, "
                    "and partner with GraphQL teams."
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
                        "Bachelor's degree or equivalent experience"
                    ),
                },
                salary_min=2800000,
                salary_max=4200000,
                salary_currency="INR",
                apply_url=(
                    "https://example.invalid/"
                    "development-only/northstar"
                ),
            ),
            ProviderJob(
                source="development",
                external_id="dev-product-2",
                title="Senior Product Engineer",
                company="Kite Systems",
                location="Remote · United States",
                country="United States",
                country_code="US",
                category="Technology",
                occupation="Product Engineer",
                remote_mode="remote",
                employment_type="full-time",
                description=(
                    "Build product experiences with Next.js, TypeScript, "
                    "PostgreSQL and strong accessibility practices. "
                    "Collaborate across design and backend teams."
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
                salary_min=145000,
                salary_max=190000,
                salary_currency="USD",
                apply_url=(
                    "https://example.invalid/"
                    "development-only/kite"
                ),
            ),
            ProviderJob(
                source="development",
                external_id="dev-platform-3",
                title="Frontend Platform Engineer",
                company="Atlas Grid",
                location="Hyderabad, India · Hybrid",
                country="India",
                country_code="IN",
                city="Hyderabad",
                category="Technology",
                occupation="Platform Engineer",
                remote_mode="hybrid",
                employment_type="full-time",
                description=(
                    "Own design-system infrastructure, React performance, "
                    "testing, CI and developer tooling across multiple "
                    "product teams."
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
                salary_min=2200000,
                salary_max=3400000,
                salary_currency="INR",
                apply_url=(
                    "https://example.invalid/"
                    "development-only/atlas"
                ),
            ),
            ProviderJob(
                source="development",
                external_id="dev-python-kochi-4",
                title="Python Backend Developer",
                company="Malabar Digital",
                location="Kochi, India · Hybrid",
                country="India",
                country_code="IN",
                city="Kochi",
                category="Technology",
                occupation="Backend Developer",
                remote_mode="hybrid",
                employment_type="full-time",
                description=(
                    "Build Python and FastAPI backend services, PostgreSQL "
                    "data models, REST APIs and cloud integrations."
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
                salary_min=1200000,
                salary_max=2200000,
                salary_currency="INR",
                apply_url=(
                    "https://example.invalid/"
                    "development-only/python-kochi"
                ),
            ),
            ProviderJob(
                source="development",
                external_id="dev-ml-bengaluru-5",
                title="Machine Learning Engineer",
                company="Indigo AI Systems",
                location="Bengaluru, India · Hybrid",
                country="India",
                country_code="IN",
                city="Bengaluru",
                category="Technology",
                occupation="Machine Learning Engineer",
                remote_mode="hybrid",
                employment_type="full-time",
                description=(
                    "Develop Python machine learning systems, model "
                    "pipelines, APIs and production ML infrastructure."
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
                salary_min=1800000,
                salary_max=3000000,
                salary_currency="INR",
                apply_url=(
                    "https://example.invalid/"
                    "development-only/ml-bengaluru"
                ),
            ),
            ProviderJob(
                source="development",
                external_id="dev-nurse-uk-6",
                title="Registered Nurse",
                company="Northshire Health Trust",
                location="Manchester, United Kingdom · On-site",
                country="United Kingdom",
                country_code="GB",
                city="Manchester",
                category="Healthcare",
                occupation="Registered Nurse",
                remote_mode="onsite",
                employment_type="full-time",
                visa_sponsorship=True,
                work_authorization=(
                    "Skilled Worker visa sponsorship is available for "
                    "eligible registered nurses."
                ),
                description=(
                    "Deliver ward-based patient care as a registered nurse. "
                    "Active professional registration is required. Skilled "
                    "Worker visa sponsorship is available for eligible "
                    "registered nurses."
                ),
                requirements={
                    "skills": [
                        "Patient care",
                        "Clinical documentation",
                    ],
                    "experience_years": 1,
                    "licenses": [
                        "Active nursing registration"
                    ],
                },
                salary_min=32000,
                salary_max=42000,
                salary_currency="GBP",
                apply_url=(
                    "https://example.invalid/"
                    "development-only/nurse-uk"
                ),
            ),
            ProviderJob(
                source="development",
                external_id="dev-accountant-ca-7",
                title="Financial Accountant",
                company="Maple Ledger Group",
                location="Toronto, Canada · Hybrid",
                country="Canada",
                country_code="CA",
                city="Toronto",
                category="Finance & Accounting",
                occupation="Accountant",
                remote_mode="hybrid",
                employment_type="full-time",
                description=(
                    "Prepare monthly financial statements, reconciliations, "
                    "budget variance analysis and audit schedules."
                ),
                requirements={
                    "skills": [
                        "Financial reporting",
                        "Reconciliation",
                        "Data analysis",
                    ],
                    "experience_years": 3,
                },
                salary_min=78000,
                salary_max=98000,
                salary_currency="CAD",
                apply_url=(
                    "https://example.invalid/"
                    "development-only/accountant-ca"
                ),
            ),
            ProviderJob(
                source="development",
                external_id="dev-civil-uae-8",
                title="Civil Site Engineer",
                company="Gulf Infrastructure Works",
                location="Dubai, United Arab Emirates · On-site",
                country="United Arab Emirates",
                country_code="AE",
                city="Dubai",
                category="Engineering & Construction",
                occupation="Civil Engineer",
                remote_mode="onsite",
                employment_type="full-time",
                relocation_support=True,
                description=(
                    "Coordinate civil site works, contractors, quality "
                    "checks and project schedules. Relocation assistance "
                    "is provided for eligible hires."
                ),
                requirements={
                    "skills": [
                        "Site supervision",
                        "Project scheduling",
                        "Quality assurance",
                    ],
                    "experience_years": 4,
                },
                salary_min=120000,
                salary_max=180000,
                salary_currency="AED",
                apply_url=(
                    "https://example.invalid/"
                    "development-only/civil-uae"
                ),
            ),
            ProviderJob(
                source="development",
                external_id="dev-sales-sg-9",
                title="Enterprise Sales Executive",
                company="Straits Commerce Cloud",
                location="Singapore · On-site",
                country="Singapore",
                country_code="SG",
                city="Singapore",
                category="Sales",
                occupation="Sales Executive",
                remote_mode="onsite",
                employment_type="full-time",
                description=(
                    "Develop enterprise accounts, manage pipeline and "
                    "negotiate commercial agreements across Southeast Asia."
                ),
                requirements={
                    "skills": [
                        "Sales",
                        "Account management",
                        "Negotiation",
                    ],
                    "experience_years": 4,
                },
                salary_min=85000,
                salary_max=125000,
                salary_currency="SGD",
                apply_url=(
                    "https://example.invalid/"
                    "development-only/sales-sg"
                ),
            ),
            ProviderJob(
                source="development",
                external_id="dev-teacher-de-10",
                title="Secondary School Mathematics Teacher",
                company="Berlin International Academy",
                location="Berlin, Germany · On-site",
                country="Germany",
                country_code="DE",
                city="Berlin",
                category="Education",
                occupation="Teacher",
                remote_mode="onsite",
                employment_type="full-time",
                description=(
                    "Teach secondary mathematics, plan lessons, assess "
                    "student progress and collaborate with the faculty team."
                ),
                requirements={
                    "skills": [
                        "Teaching",
                        "Lesson planning",
                        "Assessment",
                    ],
                    "experience_years": 2,
                },
                salary_min=48000,
                salary_max=62000,
                salary_currency="EUR",
                apply_url=(
                    "https://example.invalid/"
                    "development-only/teacher-de"
                ),
            ),
        ]

        query_text = query.lower().strip()
        location_text = location.lower().strip()

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
                    + " "
                    + (job.category or "")
                    + " "
                    + (job.occupation or "")
                ).lower()
            )
            and (
                not location_text
                or location_text in job.location.lower()
                or location_text in job.country.lower()
                or (
                    job.city
                    and location_text in job.city.lower()
                )
                or job.remote_mode == "remote"
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

    targets = settings.job_provider_targets

    providers.extend(
        GreenhouseProvider(board_token)
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
            DevelopmentJobProvider(settings)
        )

    return providers
