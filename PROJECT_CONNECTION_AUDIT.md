# Project and frontend/backend connection audit

Audit date: 2026-09-23

## Scope and worktree note

This report is analysis-only as requested in the supplied Phase 1 instructions. No additional application code was changed during this audit. The working tree was already modified before this audit began: `components/features/job-pages.tsx`, `hooks/useJobs.ts`, `backend/app/domains/jobs/router.py`, `backend/app/domains/jobs/service.py`, and an untracked `backend/.dockerignore`. In particular, the job manual-entry removal and broad-discovery behavior predate this report and have not been reverted or extended here. The prior `AUDIT.md` is dated 2026-08-31 and conflicts with the current repo contents; this report follows inspected code.

## 1. Project architecture summary

```text
Next.js App Router pages and feature components
  -> TanStack Query hooks and lib/api.ts / lib/resume-studio.ts
  -> HTTP requests to NEXT_PUBLIC_API_URL (default http://localhost:8000/api/v1)
  -> FastAPI app, CORS + origin/rate/request-context middleware, /api/v1 router
  -> domain routers -> domain services/repository helpers
  -> SQLAlchemy Session -> SQLite in development/tests or PostgreSQL in Docker/production
  -> optional external systems: job listing APIs/ATS boards, LiteLLM-compatible AI API,
     local or S3-compatible object storage, SMTP, Redis/Valkey
```

Frontend uses Next.js 15 App Router, React 19, strict TypeScript, Tailwind, Framer Motion, and TanStack Query. Backend uses FastAPI, Pydantic v2/settings, SQLAlchemy 2, Alembic, and a shared success/error envelope. `backend/app/main.py` mounts domain routers at `api_prefix` (`/api/v1`) and provides `/health` and `/ready`.

## 2. Frontend analysis

### Routes and principal flows

- Public/auth: `/`, `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/legal`.
- Onboarding: `/onboarding`, `/onboarding/resume`, `/onboarding/resume/progress/[taskId]`, `/onboarding/verify`.
- Candidate dashboard: profile and profile analysis; resume studio; preferences; job recommendations/search/saved/detail/match; documents and editors; applications/prepare/review; interview dashboard/questions/mock/STAR library; career gaps/skills/roadmap; settings, notifications, privacy.
- Admin: `/admin`, `/admin/users`, `/admin/system`.
- `/dashboard` and `/dashboard/interview-prep` are legacy/redirect-style entry routes; the dashboard root redirects to profile. `app/dashboard/layout.tsx` wraps dashboard pages in `AuthGuard` and `DashboardShell`; `app/admin/layout.tsx` does likewise for admin.

### API clients and state

- `lib/api.ts`: shared fetch wrapper, credentials include, JSON headers, `no-store`, `{data}` unwrapping, error-envelope parsing, one automatic refresh retry after 401, JSON methods and document download.
- `lib/resume-studio.ts`: typed Resume Studio endpoint facade; upload uses XMLHttpRequest for progress rather than shared fetch.
- TanStack Query hooks: `hooks/useProfile.ts`, `useJobs.ts`, `useApplications.ts`, `useInterviewPrep.ts`, `useResumeStudio.ts`; feature components use direct `useQuery`/`useMutation` elsewhere. Cache invalidation is implemented selectively after mutations.
- `lib/fixtures.ts` still contains demo profile/job/application/interview/billing records. Current hook audit shows profile, jobs, applications, and interview dashboard use backend calls, while billing/settings plan values and some marketing/dashboard display content remain hard-coded or derived locally.

### Frontend connection findings

- Most current feature pages call backend APIs and implement loading/error/empty states, but quality varies; some dense one-line components have less consistent mutation feedback.
- Direct fetch is also used by privacy export and resume upload. Both manually include cookies; export does not reuse the shared API error parser and the backend returns a ZIP stream, which is appropriate for that direct download.
- Document download and resume upload bypass `lib/api.ts` for binary/progress reasons; these are deliberate alternate transports rather than invalid endpoints.
- Navigation and dashboard labels can imply a verified profile before server profile data has loaded; informational UX risk only.

## 3. Backend analysis

### API route inventory

All paths below are prefixed by `/api/v1` unless noted. Except auth session/bootstrap operations and `GET /privacy/retention`, business routes require a verified user. Admin routes require `require_admin`; task status requires a current user and enforces task ownership. All JSON success responses are `{ok:true,data:...}`. Validation failures are 422 `{ok:false,error:{code,message,fields,request_id}}`; HTTP errors map to the same envelope with 401/403/404/request codes; unhandled errors return a sanitized 500. Default success status is 200 unless listed.

| Domain | Methods and paths | Auth | Body/query and response/dependency | Frontend use/status |
|---|---|---|---|---|
| Ops | `GET /health`, `GET /ready` | None | Health string; ready runs DB `SELECT 1`; non-envelope ops responses | Docker health checks use `/health`; otherwise operational |
| Auth | `POST /auth/register` (201), `/login`, `/refresh`, `/logout`, `/change-password`, `/verify-email`, `/forgot-password` (202), `/reset-password`; `GET /auth/session`; `GET /auth/oidc/start`, `/oidc/callback` | Register/login/recovery/token callback public; session/current password protected | Pydantic auth bodies; HttpOnly cookies; OIDC query/state cookies; SQL users, consent, refresh/email token; common envelope, callback redirects | Connected to `auth-pages.tsx`, `api.ts`, shell, settings. Dev verification/reset tokens are surfaced to clients in non-production. SMTP suppressed in development/test. |
| Profile/preferences | `GET/PATCH /profile`; `POST /profile/entries` (201); `PATCH/DELETE /profile/entries/{entry_id}`; `POST /profile/resume` (202); `GET /profile/extracted`; `POST /profile/verify`; `GET /profile/analysis`; `GET/PUT /preferences` | Verified | Profile/entry/preference Pydantic bodies; resume multipart; DB Candidate/ProfileEntry/JobPreference/UploadedFile + task/storage/parser | Connected to onboarding/profile/preferences/Resume Studio. Manual profile entry is distinct from job listing entry. |
| Jobs | `GET /jobs` with search/filter/pagination query; `GET /jobs/sources`; `POST /jobs/discover` (202); `GET /jobs/recommendations`; `GET /jobs/saved`; `GET /jobs/{job_id}`; `GET /jobs/{job_id}/match`; `POST/DELETE /jobs/{job_id}/save` (POST 201) | Verified | Discovery body limits; save note body; SQL JobPosting/MatchResult/SavedJob, provider adapters, matching; discovery task | Connected to search/recommendations/saved/detail/match and Resume Studio. Current worktree removed `POST /jobs/manual`; schema/service remain. Existing tests/setup still call removed endpoint (see issues). |
| Documents | `GET /documents` (optional type); `POST /documents/generate` (202); `GET /documents/{id}`; `POST /documents/{id}/versions` (201); `POST /documents/{id}/approve`; `GET /documents/{id}/download?format=pdf|docx` | Verified | generation/edit schemas; DB GeneratedDocument, grounding, optional LiteLLM, task/storage/PDF/DOCX; download returns file stream | Connected to document list/editor/generation/export/resume studio. |
| Applications | `GET/POST /applications` (POST 201); `GET/PATCH /applications/{id}`; `POST /applications/{id}/approve`; `/mark-applied`; `/draft-answers` | Verified | Create/update/approval/confirmation/draft-answer bodies; DB Application plus associated job/documents; owner checks | Connected to application list, preparation and review. |
| Interviews | `GET /interviews/dashboard`, `/questions?job_id&count`; `POST /interviews/sessions` (201); `GET /sessions/{id}`; `POST /sessions/{id}/answers`, `/complete`; `GET/POST /interviews/star` (POST 201); `PUT/DELETE /interviews/star/{answer_id}` | Verified | Session/answer/STAR schemas; DB InterviewSession/STARAnswer, optional job; question/feedback generation is deterministic service logic | Connected to dashboard, questions, text mock interview, STAR library. Voice/video are not implemented/enabled. |
| Career | `GET/POST /career/gaps` (POST 201); `GET /career/skills-market?analysis_id`; `GET/POST /career/roadmaps` (POST 201) | Verified | Gap/roadmap schemas; DB CareerGapAnalysis/DevelopmentRoadmap; heuristics use existing verified profile/job data | Connected to gaps, skills-market, roadmap. |
| Notifications | `GET /notifications`; `POST /notifications/{id}/read`; `GET/PUT /notifications/settings` | Verified | settings schema; DB Notification/NotificationSetting | Settings page consumes settings. Notification list/read API has no clear corresponding page consumer in current route/component scan. |
| Privacy | `GET/POST /privacy/consents` (POST 201); `GET /privacy/retention`; `GET /privacy/export`; `DELETE /privacy/account` | Consents/export/delete verified; retention public | Consent/delete bodies; DB export ZIP stream; delete removes objects/account and clears cookies | Connected to privacy settings. Delete returns JSON `{deleted:true}`, UI returns user to `/`; export direct fetch handles ZIP. Retention endpoint is consumed by privacy page. |
| Tasks | `GET /tasks/{task_id}` | Current user, owned task only | SQL AsyncJob; result shown only on success | Connected to resume parsing, document generation, suggestions, discovery polling. |
| Resume Studio | `GET /resume-studio/overview`; `POST /resumes` (202); `GET /resumes/{id}` and `/facts`; `POST /resumes/{id}/suggestions` (202); `GET .../suggestions`; `POST /suggestions/{id}`; `GET /templates`; `PUT /documents/{id}/template`; `POST /target` (202); `GET /jobs/{id}/match` | Verified | multipart PDF/DOCX, action/target/template schemas; DB, private storage, parser/worker, documents/profile/jobs, optional AI | Connected through `lib/resume-studio.ts` and Resume Studio components. |
| Admin | `GET /admin/dashboard`, `/users?page&page_size&q`, `PATCH /users/{id}`, `GET /system`, `POST /system/refresh-jobs` | Admin | user update/provider refresh schemas; DB counts/audit/users/providers/AI usage; provider calls | Connected to admin pages. Route layout’s client guard only checks session; admin authorization is correctly server-side. |

Validation/body schema details live under each domain’s `schemas.py`; query bounds are declared on routes. Error/status envelope is centralized in `backend/app/core/errors.py` and `schemas/common.py`.

### Backend data and integrations

- Models are centralized in `backend/app/models/entities.py`; migrations are in `backend/alembic/versions`. Database session is `backend/app/core/database.py`, SQLite foreign keys explicitly enabled, Postgres pool checks enabled.
- Major entities: User/Candidate/ProfileEntry/JobPreference, JobPosting/MatchResult/SavedJob, UploadedFile/ResumeSuggestion/GeneratedDocument/DocumentExport, Application, InterviewSession/STARAnswer, career analysis/roadmap, notification/settings, consent/audit, refresh/email tokens, AsyncJob, AIUsageLog.
- Domain service operations commit their own changes in many endpoints. Ownership is mostly enforced through candidate lookup and `owned_or_404`; uniqueness constraints support deduplication/idempotency.
- Job provider adapters implemented: Adzuna, Jooble, USAJobs, Reed, Greenhouse, Lever, Ashby; plus deterministic development fixtures. Providers are optional and selected by credentials/board targets. Local `.env.docker` enables development provider; provider credentials were not inspected/output. The checked `.env.docker` includes an example-like AI key string, but this report deliberately does not reproduce it; replace it with a valid secret before use.
- AI integration: `LiteLLMGateway` calls an OpenAI-compatible chat completions endpoint only for configured features. Current uses include job requirement extraction and resume suggestions/document generation. Deterministic fallbacks exist. AI does not provide job listings.
- Storage: local private storage by default in development; production Compose wires MinIO/S3-compatible storage and database task worker. SMTP is required for production local auth. Redis/Valkey is wired in compose, but middleware rate limiting is process-memory fixed-window and code comments describe Redis as production expectation; the inspected limiter does not use `VALKEY_URL`.

## 4. Frontend ↔ backend connection matrix

| Area | Status | Evidence / limitations |
|---|---|---|
| Auth/session/refresh/logout | Connected | Shared cookies and refresh retry; middleware checks cookie presence, AuthGuard checks session. Middleware is a UX gate, not security; server dependencies enforce access. |
| Profile and preferences | Connected | Hooks/pages map to profile and preference endpoints, mutate DB, invalidate relevant queries. |
| Resume upload/extraction/verification | Connected with contract caveat | Upload route, task polling, fact list, and profile verify exist. UI maps backend `verified` boolean to pending/confirmed. |
| Job search/filter/source/save | Connected, with current change | Search params and API routes align. Current search “Sync job platforms” uses `/jobs/discover`; manual listing endpoint removed in worktree. Automated fixtures still depend on it. |
| Job listing production source | Partially connected/config dependent | Provider adapters exist, but real data requires valid third-party credentials/board identifiers. Development provider yields fixture listings. No evidence of successful live provider calls from a static audit. |
| Recommendations | Connected | Candidate discovery task fetches provider jobs and computes matches. Broad empty-query behavior exists in current modified service; was not runtime-tested. |
| Documents/generation/download | Connected | List/generate/poll/edit/approve/download API endpoints and UI paths correspond. AI optional, deterministic path exists. |
| Application CRUD/approval | Connected | API and UI route mappings align, owner checks and confirmation endpoints exist. |
| Interview/STAR | Connected | Session/question/answer/complete and STAR routes have consumers. Scoring/questions are heuristic/deterministic, not live voice AI. |
| Career intelligence | Connected | Gap/market/roadmap endpoints consumed. Results are heuristic from stored roles/profile, not external labor-market feed. |
| Notifications | Partial | Settings endpoint connected; list/read endpoints have no obvious UI consumer. No inspected producer creates notification records for normal business events. |
| Privacy | Connected with limitations | Consent/export/delete routes consumed; export direct fetch doesn’t parse API error envelope; deletion UX redirects home. |
| Admin | Connected | UI endpoints exist; user-edit controls are DOM-read and not controlled state. |
| Billing/payments | Missing | UI plan/usage fixtures, no payment provider integration or billing API domain. |

## 5. Authentication and data flow

1. Signup posts name/email/password/consent to `/auth/register`; backend creates user/candidate/consent and issues access/refresh HttpOnly cookies. Development responses can include a verification token, and the signup UI auto-verifies with it.
2. Login sets cookies; frontend routes unverified accounts to verify page, otherwise to safe local `next` path.
3. `lib/api.ts` sends credentials on each request. On a 401 it POSTs `/auth/refresh` once, then retries the original request once. Refresh tokens are opaque, stored hashed server-side, rotated and revocable.
4. `middleware.ts` only checks for presence of access/refresh cookie before protected page routing. `AuthGuard` calls `/auth/session`; backend `get_current_user` decodes signed access JWT and fetches active User. Business endpoints require verified user; admin additionally requires admin role/record.
5. Logout revokes refresh token and deletes auth cookies. Password change calls service that revokes other refresh sessions (UI message says so).
6. Candidate-owned records are generally filtered by candidate ID/ownership helper. Task polling checks task user ID.

## 6. Mock / placeholder audit

- `lib/fixtures.ts`: hardcoded demo profile, job match, applications, interview questions, billing limits; inspect use sites before production rely-on. Settings plan comparison/usage includes static plan data.
- `DevelopmentJobProvider`: ten fixed listings with `development` source. Enabled by default in settings and local Docker; production runtime rejects `ENABLE_DEV_JOB_PROVIDER=true`.
- AI and job provider services have deterministic fallback behavior; this is intentional offline behavior, but UI may not always distinguish AI from fallback beyond backend generator/method metadata.
- Job and profile screens do call APIs; old `AUDIT.md` saying all hooks are fixture-backed is stale.
- Interview question scoring/feedback and career gap calculations are deterministic heuristics; no voice/video integration.
- Marketing copy/static examples are hardcoded, not live user records.
- Billing UI has no billing/subscription backend/provider.

## 7. Issues & broken connections

### High

1. **Removed job route breaks existing automated setup/tests.** Current worktree has removed `POST /jobs/manual` from jobs router while `backend/tests/conftest.py`, `test_application_interview_career.py`, and `test_workflow_regressions.py` still POST it for fixture setup. These tests will fail setup or assertions if run. The endpoint’s schema and service remain orphaned. The Resume Studio pasted-description target is a separate route and remains.
2. **No live provider configuration can be established from this audit.** Provider endpoints are implemented, but empty credentials in examples and current local development provider setting mean local demo listings are fixtures. A user-facing sync action alone does not guarantee a configured live provider or successful sync.
3. **Account deletion semantics are weaker than the privacy UI may imply.** Backend removes stored resume objects best-effort (swallows storage delete errors) then deletes account; DB cascading covers dependent records, but documents may have storage object keys and those exports are not visibly cleaned from object storage. This may leave generated file artifacts after account deletion.

### Medium

4. **API definitions are not consistently typed/documented with response models.** Many routes return untyped dictionaries and frontend manually duplicates TypeScript shapes; build/typecheck cannot catch runtime contract drift.
5. **Task worker deployment mode needs configuration discipline.** Production uses database-backed tasks/worker in Compose. Inline mode dispatches in API process; operators should confirm all task kinds execute consistently in each deployment path.
6. **Notification delivery path appears incomplete.** Settings and read/list API exist, but no UI list/read screen is located and no regular domain-event producer was found in inspected routers/services.
7. **Rate limiting is per-process memory only.** `VALKEY_URL` exists and Compose runs Redis, but inspected `RateLimitMiddleware` stores queues in Python memory, so production multi-replica limits are not shared and restart resets them.
8. **Privacy export is a direct fetch with generic error text.** It does not reuse `parseError`, so server field/error detail is lost to user; download itself matches ZIP response.
9. **Local environment config contains placeholder-looking AI key text.** Secrets weren’t emitted here; ensure it is replaced/rotated if it was ever a real credential. It is in an ignored local file and should remain outside version control.
10. **Admin user editing uses uncontrolled fields and DOM lookup.** Search returns up to 50 users (despite backend pagination); save uses DOM IDs rather than React state; if list changes or a control is absent it can throw. Also client can set role admin; backend supports this and admin UI exposes it, so administrator escalation is by design but should be governed/audited carefully.

### Low

11. **Current changed discovery behavior was not validated against a live provider.** Empty query fallback implementation is statically present but provider-specific blank-query semantics vary; no network/provider tests were run.
12. **Stale `AUDIT.md` materially misstates the codebase.** It says no backend/config/tests/docker exist and claims existing screens are mock-only; current repository now has all of these. Update audit docs after Phase 1 approval.
13. **Possible local CORS/origin guard mismatch.** Main app augments standard localhost origins in development CORS, but `OriginGuardMiddleware` checks only configured origins from settings. Default `.env.docker` explicitly lists its localhost origins; if an operator configures CORS list differently, browser preflight/CORS and origin guard may disagree.
14. **Some frontend mutations lack uniform pending/error feedback/cache invalidation.** Most main flows have handling, but component-by-component UX consistency varies.

### No broken endpoint detected in common API facade scan

All current frontend API paths examined correspond to a registered backend route after `/api/v1`, except that the former `/jobs/manual` frontend call and route have both been removed in the current worktree. The remaining discrepancy is tests/setup still depending on that removed route.

## 8. Build/test/lint results

Commands/results from this environment:

- `npm.cmd run typecheck` — **passed** (`tsc --noEmit`).
- `npm.cmd run build` — **passed**; Next.js compiled, lint/type validity passed, and 40 static pages generated.
- `npm.cmd test` — **could not start**: Vitest/esbuild reported sandbox access denied reading parent directory `..` and failed loading `vitest.config.ts`.
- `python -m pytest -q` — **not run**: `python` command is unavailable. No `py`, `python3`, `uv`, or backend venv was found.
- `python -m ruff check app tests` — **not run** for the same missing Python runtime.
- No lint script exists in `package.json`; `next build` reports its own lint/type step and succeeded.
- `git diff --check` — **passed** (only line-ending warnings from Git).

## 9. Phase 2 recommended order

1. Decide the intended `/jobs/manual` contract. If manual listing entry stays removed, replace test fixture setup with a test-only provider/seed helper and remove orphan schema/service; preserve Resume Studio’s separate pasted target if desired.
2. Expose provider enablement/sync outcome in candidate UI (configured sources, per-provider failures, last sync, no-live-provider message); configure authorized API credentials/ATS boards in deployment secrets. Verify actual provider behavior in integration tests.
3. Add response schemas/OpenAPI contracts and shared frontend types for high-traffic routes; test each frontend-consumed endpoint for method/body/query/response consistency.
4. Complete notification producer and list/read UI, or remove unused API/settings if notifications are out of scope.
5. Define account deletion artifact-retention policy and delete all user-owned object artifacts with reliable retry/audit behavior.
6. Use shared distributed rate-limit store (Redis/Valkey) for multi-instance production and verify proxy/IP trust configuration.
7. Improve privacy export error parsing and admin list/editor pagination/state behavior.
8. Add/maintain integration tests for auth refresh, upload/task polling, job discovery providers, documents, applications, account export/deletion; make CI run Python and frontend suites.
9. Refresh `AUDIT.md` and document actual fixture-backed screens, deterministic fallbacks, external credentials, and production setup.
