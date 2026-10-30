# CareerPilot AI engineering rules

Read existing documentation before making changes. Work from a concise task and acceptance criteria. Consult docs/ai-engineering/CONTEXT_INDEX.md for file ownership. Inspect only relevant files and their imports; avoid repeated repository-wide scans. Reuse existing code, tests and prior audits. Keep diffs small and avoid unrelated refactoring.

Run targeted tests first, then wider checks when risk warrants. Report changed files, test results, risks and next action. Never claim unrun checks passed.

Do not expose secrets or candidate data. Ground AI-generated career claims in user-confirmed facts. Preserve production email-verification enforcement, authorization and user data. Never reset local work, remove Docker volumes or restart unrelated services on the shared VPS. Require approval for infrastructure, security, database, billing and production changes.

The documents under docs/ai-engineering/ are planning aids; verify against source before relying on them.
