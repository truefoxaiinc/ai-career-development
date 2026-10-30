# Feature registry — evidence-limited

Statuses: code-evidenced (observed route/code, not E2E verified), documented (README claim), unverified (requires testing).

| Feature | Evidence | Status | Next check |
| --- | --- | --- | --- |
| Marketing and plan cards | app/page.tsx | code-evidenced | Confirm real entitlements and billing |
| Login and session guard | components/auth-guard.tsx; backend/app/domains/auth/router.py | code-evidenced | E2E verification policy and redirects |
| Resume onboarding | README.md | documented | Upload, extract, confirm facts |
| AI Resume Studio | README.md | documented | Generate, approve and export |
| Job matching | README.md | documented | Ranking quality, data provenance |
| Applications | README.md | documented | Persisted stage transitions |
| Interview prep | README.md | documented | Question and answer persistence |
| AI cost bounds | README.md | documented | Actual enforcement and telemetry |
| Production hosting | README.md | documented | Secrets, rollback, backups |

Do not infer feature completeness from a route or README. Add file evidence and acceptance criteria during scoped implementation audits.
