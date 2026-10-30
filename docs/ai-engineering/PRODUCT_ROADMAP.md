# CareerPilot product roadmap (proposal)

## P0 — Trust and functional baseline
Test signup -> resume upload -> extracted-fact confirmation -> matching -> tailoring -> export -> application tracking. Record failures, latency, costs and time to first value. Verify advertised plans against backend entitlements. Exit: reproducible E2E journey and measured baseline.

## P1 — Simpler SaaS UX
Propose five navigation groups: Overview, My Career, Find Jobs, Applications, Interview Coach. Preserve existing routes and functionality. Simplify resume-first onboarding, mobile navigation, accessible forms and next-action guidance. Exit: user-tested desktop/mobile journeys.

## P2 — AI quality and cost
Reuse user-confirmed structured facts; deterministic operations before LLMs; evaluate model routing, prompt versioning, caching and schema validation. Exit: measured quality non-regression and cost/latency improvement.

## P3 — Release readiness
Audit authorization, privacy, deletion, rate limits, billing, backups, restore, observability and rollback. Exit: approved production release checklist.

Implement in small PRs. This roadmap authorizes no code, database, infrastructure or production changes.
