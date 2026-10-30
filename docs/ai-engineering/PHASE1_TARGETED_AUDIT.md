# CareerPilot Phase 1 — targeted product and AI audit

Date: 2026-10-30. Scope: repository documentation and selective source inspection only. This is **not** a runtime, security penetration, billing or end-to-end test.

## Confirmed observations

| Area | Evidence | Finding | Next action |
| --- | --- | --- | --- |
| Backend route coverage | `backend/app/api/v1/router.py` | Routers registered for auth, profiles, jobs, documents, applications, interviews, career, notifications, privacy, tasks, resume studio and admin. Registration does **not** prove implementation quality or frontend connectivity. | Inspect one journey's handler, persistence and frontend hook end-to-end |
| Authentication | `components/auth-guard.tsx` | Guard uses server-supplied `email_verification_required`, not merely `is_email_verified`; unauthenticated requests redirect to login. | Browser-test enabled and disabled verification modes; confirm production config |
| AI controls | `backend/app/core/config.py` | Config fields exist for LLM endpoint/model, timeout (45s), max request cost ($0.10), max output tokens (2400), retries (2). **Enforcement and telemetry not verified.** | Trace call sites and tests; measure actual cost and failure handling |
| Job discovery | `backend/app/core/config.py` | Settings for Adzuna, Jooble, USAJobs, Reed and development provider exist. `enable_dev_job_provider` defaults true. | Verify runtime configuration, provider attribution, freshness and production exclusion of fixtures |
| Mock data | `lib/fixtures.ts` | Contains synthetic candidate Maya Rao, jobs, applications, interview questions and billing. Existence alone does not show live UI usage. | Find imports/call sites; eliminate demo data from authenticated production views if present |
| Product pricing | `app/page.tsx` | Marketing cards advertise Free ₹0, Pro ₹999/month, Team custom and specific limits. | Verify actual billing, backend entitlements and disclosure before launch |
| Docker stack | `docker-compose.yml` | Defines frontend, API, PostgreSQL/pgvector, Redis and test services. | Compare active server/proxy overlays without modifying deployment |

## Risks prioritized for verification

**P0: Product truth.** Confirm users never mistake fixtures or marketing demonstrations for real job recommendations, application status, AI results or purchased entitlements.

**P0: AI evidence and budget.** Trace resume -> user-confirmed profile -> job match -> tailored resume. Verify no invented achievements, per-user isolation, request budget enforcement and prompt/context reuse. Config fields alone are insufficient.

**P0: Critical journey.** Execute test signup/login, resume upload, fact confirmation, job selection, tailoring, export and application tracking in an isolated test environment. Record actual breakpoints and user-facing errors.

**P1: Simpler UX.** Map all navigation routes and consolidate into five primary groups without deleting useful screens or breaking deep links.

**P1: Operability.** Validate readiness, background tasks, job provider errors, rate limits, storage, backups and rollback on test infrastructure only.

## Minimal next implementation slices (separate PRs)

1. **AUD-002 Fixture trace:** locate `lib/fixtures.ts` imports and confirm where synthetic values are rendered; write targeted tests for any production leak.
2. **AUD-003 AI trace:** follow LLM call paths and cost guard; capture safe token/cost/latency baselines without user data.
3. **AUD-004 Critical E2E:** automate one resume-to-application journey with synthetic input and explicit failure states.
4. **UX-001 Navigation prototype:** propose five-group information architecture, preserving routes and permissions.

## Acceptance criteria for Phase 1 completion

- Evidence-backed inventory of actual vs mock workflows, with relevant file paths.
- Measured AI request behavior or explicit blocker if credentials/telemetry unavailable.
- Reproducible end-to-end test result and failure list.
- Prioritized, small PR backlog with risk and expected outcome.
- No changes to shared VPS, application code, databases, security settings or billing.

## Validation and limits

Read existing `AGENTS.md` and `docs/ai-engineering/FEATURE_REGISTRY.md` before inspection. Inspected `backend/app/api/v1/router.py`, `backend/app/core/config.py`, `components/auth-guard.tsx`, `lib/fixtures.ts` and previously reviewed `app/page.tsx`, `README.md`, `docker-compose.yml`. No automated tests executed, no runtime or user data accessed. No speculative claims of confirmed defects. This report is an initial **targeted static audit**, not a completed Phase 1 functional audit.
