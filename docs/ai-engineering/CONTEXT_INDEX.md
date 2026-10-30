# CareerPilot context index

Reviewed 2026-10-30 from targeted repository reads, not a full audit.

| Area | Entry files | Checks |
| --- | --- | --- |
| Product and route overview | README.md; app/page.tsx | Verify marketing claims against actual features |
| Frontend dependencies | package.json | npm run typecheck; npm test; npm run build |
| Auth UX | components/auth-guard.tsx; components/features/auth-pages.tsx; middleware.ts | Session and redirect integration |
| API | backend/app/main.py; backend/app/api/v1/router.py | API tests |
| Authentication | backend/app/domains/auth/router.py; backend/tests/test_auth.py | Verification enabled and disabled |
| Deployment | docker-compose.yml; server/proxy overlays | Never touch unrelated containers |
| Resume and AI workflows | README.md sections on Resume Studio and gateway | Locate implementation and tests before editing |

Stack observed: Next.js 15, React 19, TypeScript, FastAPI, PostgreSQL/pgvector, Redis and Docker. Documentation is not proof of runtime readiness. Inspect only files relevant to the next task.
