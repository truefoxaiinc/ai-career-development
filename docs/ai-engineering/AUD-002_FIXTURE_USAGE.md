# AUD-002 — Synthetic fixture usage audit

Date: 2026-10-30. Static targeted review; no runtime or E2E execution.

## Confirmed source facts

- `lib/fixtures.ts` exports synthetic `profile` (Maya Rao), `jobMatch` (Northstar Labs), `applications`, `interviewGroups`, `billing`, and `statuses`. Their presence is **not** proof of a production data leak.
- `app/dashboard/profile/page.tsx` delegates to `MasterProfilePage`; `components/features/profile-pages.tsx` imports `useProfile` from `hooks/useProfile.ts`. That hook calls `api.get('/profile')`, not the fixture module.
- `app/dashboard/applications/page.tsx` delegates to `ApplicationsDashboard`; `components/features/application-pages.tsx` imports `useApplications` from `hooks/useApplications.ts`. That hook calls `api.get('/applications')`, not the fixture module.
- `app/dashboard/jobs/page.tsx` redirects to recommendations; `components/features/job-pages.tsx` uses `hooks/useJobs.ts`, whose queries request `/jobs`, `/jobs/recommendations`, `/jobs/saved`, and `/jobs/sources`.
- `components/features/interview-pages.tsx` uses `hooks/useInterviewPrep.ts`; its dashboard hook calls `/interviews/dashboard`.
- `components/features/settings-pages.tsx` uses the API for account/session details. This does **not** independently verify any billing/plan enforcement.

**Conclusion:** Four inspected authenticated feature paths (profile, applications, jobs, interview dashboard) use API-backed hooks. No fixture import was observed in these inspected paths. This is **not** a complete repository-wide import search, so fixture usage elsewhere remains unverified.

## Remaining checks, ranked

1. Search for all imports of `@/lib/fixtures`, `lib/fixtures`, and named fixture exports in the repository, including tests, stories and marketing pages. Classify each as demo/test, authenticated UI or unreachable code.
2. Inspect API response adapters and job-provider development fixtures, particularly `enable_dev_job_provider` default in `backend/app/core/config.py`. Confirm production cannot surface synthetic jobs without explicit demo labeling.
3. Inspect settings/billing surfaces and compare any plan claims with backend entitlement enforcement.
4. Add a focused regression test **only if** an actual authenticated production fixture path is confirmed.

## Acceptance criteria

- Exhaustive fixture-import map with file/line evidence.
- No unlabelled synthetic candidate, job, application or billing records in authenticated production UI.
- Clear empty/error/loading states for missing real data.
- Targeted test output and final evidence-based classification.

## Constraints and validation

This PR is audit documentation only. No application code, Docker, database, secrets, production settings or unrelated services were changed. Tests were not run. Avoid deleting fixtures or adding broad mock-blocking logic until a real call site and risk are established.
