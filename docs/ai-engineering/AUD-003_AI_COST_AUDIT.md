# AUD-003 — AI gateway cost and token audit

Date: 2026-10-30. Targeted static review; no live provider calls, tests or production access.

## Evidence-backed findings

**P0 — Post-response cost check is not a spending cap.** In `backend/app/ai/gateway.py`, `LiteLLMGateway.complete_json` sends the request and only then compares `estimated_cost` with `llm_max_cost_usd_per_request`. The limit rejects an over-budget *result* but cannot prevent the upstream bill. Preserve the existing guard, but add preflight estimates and/or provider-enforced budgets with explicit assumptions.

**P0 — Unknown cost recorded as zero.** `_extract_cost` reads `estimated_cost`, `response_cost`, and `x-litellm-response-cost`, then returns `Decimal("0")` if none is usable. Unknown is not free; distinguish missing pricing/usage from a genuine zero-cost response. Ensure accounting remains robust if provider omits usage.

**P1 — Telemetry on failed or over-limit responses is incomplete.** `_record_usage` runs after the cost-limit check and before content validation. Thus cost-limit failures and certain HTTP/timeout/invalid-body paths may not be logged, while malformed model output can still have a usage log. Define explicit statuses and record all billable attempts where data is available; don't log sensitive payloads.

**P1 — Retry cost amplification.** `llm_retry_attempts` bounds attempts, and the gateway retries HTTP 5xx, timeout and transport errors. Retries can incur additional charges. Evaluate exponential backoff, idempotency if provider supports it, and per-feature budgets without changing behavior until tests.

**P1 — Large resume-suggestion context.** `backend/app/domains/resume_studio/service.py` can send extracted resume text (up to 18,000 characters), up to 120 verified entries, 80 unverified entries and two recent document contents (up to 12,000 characters each). This is a potential token hotspot, not a measured cost. Consider compact evidence selection and input-version-aware caching after quality evaluation.

## Existing positive controls

- `backend/app/core/config.py` defines timeout, output-token limit, retries and request-cost threshold.
- `backend/app/ai/gateway.py` requests JSON object output and parses it, tracks latency/tokens/cost where supplied and writes `AIUsageLog` independently of domain transaction rollback.
- `backend/app/ai/grounding.py` includes untrusted-text bounding and claim verification. Its heuristic confidence is not a guarantee of factual correctness.
- `backend/app/domains/resume_studio/service.py` generates deterministic suggestions before optional LLM enrichment.

## Proposed implementation slices (approval required)

1. **AI-001 Cost accounting correctness:** explicit unknown-cost status, record failed/over-limit attempt telemetry without PII, tests for missing/invalid headers and provider responses.
2. **AI-002 Budget enforcement:** preflight upper-bound estimates, request/tenant quotas, retry budget, provider-side limits if supported; test rejected requests before provider call.
3. **AI-003 Context reduction:** measure baseline prompt tokens on synthetic resumes, send only task-relevant confirmed facts, version cache keys, compare output quality and grounding.
4. **AI-004 Observability:** dashboard for per-feature successful task cost, p50/p95 latency, token use, failure and cache rates.

## Validation and boundaries

No claim of measured savings or production incident. No application, infrastructure, database, billing, security or server changes. Tests not executed; findings are from targeted file inspection. Before implementation inspect existing gateway tests, model/provider pricing semantics, telemetry schema and callers. Use synthetic test data and small PRs.
