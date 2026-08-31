# CareerPilot repository audit

Audit date: 2026-08-31

## Current technology stack

- Next.js 15.1 App Router, React 19, TypeScript 5.7 (strict mode)
- Tailwind CSS 3.4 with CSS-variable design tokens and dark/light themes
- TanStack Query 5 for client-side resource hooks
- Framer Motion 11 for transitions and score animations
- Lucide React icons; Inter / Instrument Serif / JetBrains Mono via Fontsource
- No backend, database, migrations, object storage, queue, authentication provider, API client, OpenAPI contract, tests, lint config, Docker configuration, environment example, or deployment configuration is present

## Existing pages

- `/` landing page: visually complete, static marketing content
- `/login`: visual form only; no authentication or password-reset link
- `/signup`: visual form only; no registration behavior or consent capture
- `/onboarding`: four-step client-only wizard using hard-coded example values; upload is not implemented
- `/dashboard/profile`: polished evidence-profile UI backed by fixtures
- `/dashboard/jobs`: polished job-match / resume-generation demo backed by fixtures and local state
- `/dashboard/applications`: application table/kanban demo backed by fixtures and local state
- `/dashboard/interview-prep`: interview-question demo; mock-interview capability is explicitly a placeholder
- `/dashboard/settings`: billing/usage demo backed by fixtures
- `/dashboard`: redirect-style entry to profile

## Missing pages / major planned screens

Most of the required 38-screen product is absent as a distinct route. Missing areas include forgot/reset password, legal pages, dedicated resume upload/progress/verification routes, profile analysis, job preferences/recommendations/search/details/match analysis/saved jobs, resume/cover-letter editors and document library, application preparation/approval, mock interview/feedback/STAR library, career intelligence, notifications/alerts, privacy export/deletion, and all admin/monitoring screens.

## Reusable components worth preserving

- CSS-variable design tokens and typography in `app/globals.css` / `tailwind.config.ts`
- `DashboardShell` responsive navigation and command-palette concept
- `Button`, `Input`, `Textarea`, `Select`, `Panel`, `Skeleton`, `PageHeader`, `SkillChip`, `StatusPill`, `MatchScoreRadial`, and citation-reference primitives
- `MatchBreakdown` explainable strong/partial/missing match presentation
- `ApplicationAction` explicit confirmation pattern before marking an application applied
- Toast provider, reduced-motion handling, dark/light theme toggle

## Broken or incomplete functionality

- Every data hook imports `lib/fixtures.ts`; no real API integration or persistence exists
- Login, signup, LinkedIn sign-in, job analysis, profile editing, uploads, export, generation, and settings controls do not call a backend
- Onboarding values are hard-coded and do not persist
- Command palette embeds fixture applications directly
- Generated resume example allows an unsupported claim to be retained after acknowledgement; this conflicts with the plan's hard anti-fabrication rule
- No route protection or authorization exists
- No loading/error/empty behavior for real network failures; skeletons are simulated with sleeps
- No document versioning, actual PDF/DOCX export, background jobs, progress polling, source integrations, or application submission integration

## Backend requirements

A backend must be added. The project plan recommends FastAPI, Pydantic, PostgreSQL 16 + pgvector, cache/queue infrastructure, S3-compatible object storage, OIDC/OAuth2, and LiteLLM with async workers for long-running parsing/matching/generation. The initial implementation should be domain-separated, versioned under `/api/v1`, use UUIDs/timestamps/ownership checks, and keep all development adapters clearly separated from production provider paths.

## Security / privacy problems

- No authentication, session handling, RBAC, ownership checks, rate limiting, CORS policy, audit logging, or consent records
- No file MIME/size validation because upload is not implemented
- No data export/deletion or retention controls
- No protection against uploaded-content prompt injection
- No secret-management boundary because there are no backend integrations yet
- Static demo PII-like names/experience are compiled into the frontend bundle

## Accessibility problems / strengths

Strengths: semantic labels are used in several forms, focus-visible styles exist, reduced-motion preferences are respected, and the responsive navigation has labels.

Gaps: modal/palette focus containment and focus restoration are incomplete; form errors are not associated with fields; success-only toast semantics are too limited; async error states are absent; some controls rely on popovers without robust dialog semantics; no automated WCAG checks are configured.

## Recommended implementation order

1. Preserve the current design system; add shared app/navigation/form/error-state primitives.
2. Add backend foundation, configuration, database models/migrations, consistent API responses, health checks, and local Docker services.
3. Add authentication/authorization and route protection.
4. Complete candidate onboarding/profile/resume upload -> async extraction -> verification as the first production vertical slice.
5. Add job-source provider interfaces, development-only seed adapter, persisted jobs, preferences, search and explainable matching.
6. Add grounded document generation with claim verification, versioning and PDF/DOCX exports.
7. Add saved jobs/application preparation/approval/tracking with exact document-version references.
8. Add interview preparation/mock sessions/STAR library, then career intelligence.
9. Add privacy controls and admin/monitoring screens.
10. Add comprehensive tests, observability, accessibility checks and production/deployment documentation.

## Audit conclusion

The frontend is a strong visual prototype rather than a production application. Its design language and several interaction primitives should be retained. There is no existing backend to preserve. The safest implementation path is to replace fixture-backed hooks incrementally with a typed API client while adding a FastAPI backend and persisted workflows, starting with authentication + verified career profile and then job matching/document generation.
