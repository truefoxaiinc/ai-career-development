# Quality gates

Documentation: check paths and diff scope.
UI: run typecheck and focused frontend tests.
API and authentication: run focused pytest and session/permission regression checks.
AI: validate structured outputs, groundedness, latency and cost limits.
Storage: review migrations, privacy, backup and rollback.
Release: run build, smoke tests and health checks.

Run checks proportionately. Never report unexecuted tests as passed. Use isolated test configuration.
