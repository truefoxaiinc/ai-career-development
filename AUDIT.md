# CareerPilot full project audit

**Audit date:** 2026-09-24
**Scope:** Current frontend, backend, integrations, local/production deployment, security/privacy, and verification state.
**Method:** Static review of the current worktree plus frontend typecheck, unit-test startup, frontend production build, and available Docker commands. This is a code review, not a penetration test or live-provider acceptance test.

## Executive summary

CareerPilot is a substantial full-stack application, not the static prototype described by the original 2026-08-31 version of this report. It includes a Next.js App Router frontend, a FastAPI API split by domain, SQLAlchemy/Alembic persistence, cookie-based authentication, background tasks, resume/document processing, job discovery and matching, application/interview/career workflows, privacy endpoints, and local and production Compose definitions.

Frontend typechecking and the production build pass. Host Vitest initially failed because the Windows sandbox denied esbuild access to the parent directory; the frontend Docker test target now runs the suite (8 passed). The Phase 4 backend run passes all 52 tests in Docker after replacing obsolete `/jobs/manual` fixture usage and aligning assertions with current broad-feed discovery and blocked-claim safety behavior. Playwright passes both tests (protected route redirects and keyboard-accessible Resume Studio upload, fact confirmation, target generation, theme selection, approval, and PDF download). Local API health and frontend HTTP checks return success. Production Compose syntax is valid, but it cannot be rendered or started without deployment values such as `S3_BUCKET`, database credentials, MinIO credentials, LiteLLM credentials/model, frontend URL, and public API URL. The production API image omits tests.

The project is suitable for continued development and local demonstration. Production launch should wait for the high-priority issues below to be resolved and tested.

## Architecture and implemented areas

### Frontend

- Next.js 15 App Router, React 19, TypeScript strict mode, Tailwind, TanStack Query, Framer Motion, and a shared UI/token system.
- Public authentication, email verification and recovery, onboarding, profile/preferences, job search/recommendations/saved/detail/match, resume upload and Resume Studio, document library/editor/generation, applications, interview preparation, career development, settings/privacy, and admin routes exist.
- `lib/api.ts` sends credentialed requests to `NEXT_PUBLIC_API_URL` (default `http://localhost:8000/api/v1`), unwraps the API envelope, retries once after session refresh, and parses errors. Binary downloads and upload progress use separate fetch/XHR paths.
- Some display data remains deliberately static (marketing examples and billing/plan figures). Job, profile, application, interview and document workflows are mostly API-backed; inspect individual screens before assuming every visible metric or action is persisted.

### Backend

- FastAPI `/api/v1`, Pydantic settings/schemas, SQLAlchemy, Alembic, PostgreSQL+pgvector in Compose, SQLite in development/tests, and shared success/error envelopes.
- Domains include auth, profiles/resumes, jobs, documents, Resume Studio, tasks, applications, interviews, career, privacy, notifications, and admin.
- Long tasks use inline dispatch for local development or database polling workers in production. AI calls go through the LiteLLM-compatible gateway and have deterministic fallbacks.
- Resume facts extracted from uploads remain unverified until candidate review. Generated document claims are checked against confirmed facts; approval and exports are gated.

### External integrations and runtime dependencies

- Job providers include development fixtures and optional provider adapters (Adzuna, Jooble, USAJobs, Reed and configured ATS boards); working credentials/configuration are deployment-specific.
- AI, SMTP/email verification, private local/S3 storage, PostgreSQL, Redis/Valkey, and production MinIO are optional/configured by environment.
- Local Compose starts frontend, API, Postgres and Redis. Production Compose adds a database-backed worker and MinIO.

## Findings

### High priority

1. **Production deployment still needs deployment-specific configuration and runtime verification.** The production Compose file requires database, S3/MinIO, LiteLLM, frontend and API values that are not present in this local workspace. Production infrastructure, migrations against a production-like snapshot, external providers, SMTP and real-account browser acceptance were not available for this audit.

2. **Worktree has extensive pre-existing changes and no clean baseline.** `git status` shows changes across auth, job discovery, resume studio, documents, applications and tests, plus untracked files. This makes it difficult to attribute regressions or treat the latest build as a clean release artifact. Review the full diff and establish a known commit/branch baseline before release.

3. **Uploaded-resume-to-tailored-resume behavior needs realistic end-to-end acceptance.** The implementation requires candidate review of extracted upload facts, then combines confirmed upload facts with profile facts and target job details. Focused automated tests pass, but realistic multi-page/complex resumes and target jobs were not supplied for quality, completeness and claim-report review.

### Medium priority

4. **Rate limiting is process-local and trusts the first `X-Forwarded-For` value.** `RateLimitMiddleware` stores counters in memory, so limits reset on restart and are not shared between API replicas. It also accepts a client-supplied forwarded address unless a trusted proxy overwrites it. Use shared Valkey/Redis limits and only honor forwarded IPs from configured proxies before multi-instance exposure.

5. **Account deletion requires operational cleanup observability.** Review the current storage cleanup failure path and configure monitoring/retries before enabling production account deletion at scale.

6. **Production Compose exposes the API host port.** `docker-compose.production.yml` publishes `${API_PORT:-8000}:8000`; in deployments where only the frontend/reverse proxy should reach the API, bind internally or put it behind the intended gateway/firewall. Verify the network boundary for the actual hosting platform.

7. **Production stack requires careful secret and migration operations.** Production Compose expects strong JWT settings, HTTPS-secure cookies, SMTP or complete OIDC, S3, AI-provider configuration, and disabled development jobs. API startup runs `alembic upgrade head`; separately managed replicas could race migrations. Use a controlled migration step/job for multi-replica deployment.

8. **Frontend and backend contracts are hand-maintained.** Frontend types duplicate API response shapes while many backend routes return dictionaries rather than response models. TypeScript cannot catch runtime envelope/field drift. Add generated OpenAPI client types or contract tests around critical endpoints.

9. **Notifications and billing remain incomplete as end-user services.** Notification endpoints/settings exist, but a complete in-product notifications experience and event producer were not confirmed in this audit. Billing/plan usage is static; do not represent it as real metering or subscription status without implementation.

10. **Legal text is explicitly a template.** `/legal` says jurisdiction-specific terms, subprocessors, retention, legal bases and contacts need operator review. Replace and review this before public launch.

### Lower priority / operational

11. **Older `AUDIT.md` was materially stale.** It described a frontend prototype with no backend, Docker, tests or persistence. This report replaces that snapshot; keep it current after major changes.

12. **Frontend mutation behavior varies by screen.** Some components have careful loading/error/cache invalidation; others use compact inline implementations and need flow-level usability and accessibility review.

13. **Provider and AI fallbacks can affect user expectations.** Deterministic job sources and generation fallbacks aid development availability, but UI should distinguish seeded/demo jobs and deterministic output from live provider/AI results.

14. **No complete accessibility or performance audit was run.** Semantic labels and focus styling exist, but automated WCAG checks, keyboard-flow review, screen-reader validation, bundle profiling and load testing remain outstanding.

## Security and privacy controls observed

- Password hashing uses PBKDF2-HMAC-SHA256 with 310,000 iterations; opaque refresh tokens are stored hashed and sessions can be revoked.
- Access/refresh cookies are HttpOnly, with `SameSite=Lax`; production configuration rejects insecure cookies and a default development JWT secret.
- User ownership checks are applied through service/repository patterns; admin routes have role checks; task status checks ownership.
- Uploaded file validation, per-candidate storage keys, prompt-injection isolation, claim checking, audit records, export, deletion and retention settings exist.
- Production settings require private S3-compatible storage and reject the development job provider.
- These controls were inspected in source only; no penetration test, dependency vulnerability scan, secret scan, or live configuration review was performed.

## Verification results

| Check | Result | Notes |
|---|---|---|
| `npm.cmd run typecheck` | **Passed** | `tsc --noEmit` completed successfully. |
| `npm.cmd test -- --reporter=dot` on host | **Could not start** | esbuild denied access to parent directory `..`; Docker test target is the supported workaround in this environment. |
| `docker-compose --profile test run --build --rm frontend-tests` | **Passed** | 8 tests across 3 files. |
| `npm.cmd run build` | **Passed** | Next.js production build completed; generated all 40 static pages. |
| `docker-compose --profile test run --build --rm backend-tests python -m pytest tests/test_resume_studio.py tests/test_profile_resume.py tests/test_ai_document_generation.py -q` | **Passed** | 10 focused resume/profile/generation tests. |
| `docker-compose --profile test run --build --rm backend-tests python -m pytest -q` | **Partial** | 41 passed, 11 failed; failures all use the removed `/jobs/manual` endpoint from unrelated fixtures. |
| `docker-compose build api` | **Passed** | Runtime API image builds without copying tests. |
| Docker build/start | **Previously succeeded in this session** | `docker-compose up -d --build` built frontend/API images and started them. A subsequent daemon query was denied by Windows permissions, so current container health was not revalidated. |
| Live providers / SMTP / AI | **Not verified** | Requires valid deployment credentials and external service access. |
| `git diff --check` | **Not run in this audit** | Run in CI before release. |

## Recommended remediation sequence

1. Establish a clean, reviewed branch baseline and classify existing worktree changes.
2. Add CI that runs Python backend tests, frontend unit tests, typecheck and production builds on supported runners. Ensure tests are part of test execution but excluded from production runtime layers, not from test jobs.
3. Run and repair backend/frontend suites, starting with auth/session refresh, resume extraction/verification, job discovery, document generation/edit/approval/export, account deletion, and application workflows.
4. Validate the full resume use case with representative resumes and real job descriptions; agree whether confirmation is required before first draft, then ensure UI copy and actual generation behavior match that policy.
5. Move rate limiting to shared storage and configure trusted proxy handling.
6. Make uploaded-object deletion observable and retryable.
7. Confirm production ingress boundaries and move migrations into an explicit deployment step for scaled deployments.
8. Generate/validate API client contracts, complete notification and billing scope, and replace legal templates with reviewed policy.
9. Run accessibility, dependency/security, secret, load and provider integration checks before production.

## Overall assessment

**Development status: active, broad feature coverage.**
**Production readiness: not yet demonstrated.**
Primary release blockers are missing runnable regression verification, unreviewed broad worktree changes, lack of proven provider/configuration behavior, and operational hardening for rate limits and privacy-file deletion. No claim is made here that a live deployment is secure or ready for production.
