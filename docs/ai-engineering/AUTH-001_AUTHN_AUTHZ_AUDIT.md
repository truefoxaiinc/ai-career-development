# AUTH-001 — Frontend and backend authentication/authorization review

Date: 2026-10-30. Targeted static inspection, not a full penetration test.

## Findings and evidence

1. **Frontend admin route authorization (fixed in this PR):** `app/admin/layout.tsx` previously wrapped admin pages in the generic `AuthGuard` only, which verifies a session but not admin permission. `components/admin-authorization-guard.tsx` now requires a successful `GET /admin/dashboard` response before rendering the admin shell. 403 renders an access-denied state. This is UX defense in depth; backend remains the security boundary. Existing endpoint is protected by `require_admin` and recognizes both admin role and delegated AdminRole rows.
2. **Backend admin authorization (present):** `backend/app/domains/admin/router.py` uses `Depends(require_admin)` for inspected admin routes; `backend/app/core/security.py` checks user role or AdminRole row. Verify every future admin endpoint follows this pattern.
3. **Authentication (present):** `get_current_user` validates JWT signature, issuer, audience, expiry, session ID, revocation, expiry and active user. `require_verified_user` applies policy-based email verification. `components/auth-guard.tsx` uses the server's verification requirement.
4. **Frontend middleware (not authority):** `middleware.ts` checks only presence of cookies before redirecting. Cookies may be stale/forged; backend dependencies and the session query must remain authoritative.
5. **Session and cookies (present):** `backend/app/domains/auth/router.py` handles login, refresh, logout, password change/reset and verification; `set_auth_cookies` uses HttpOnly, configurable Secure and SameSite=Lax. Production configuration must enforce HTTPS/Secure.
6. **CSRF/origin validation (needs further review):** `OriginGuardMiddleware` rejects disallowed origins on unsafe methods **when an Origin header exists**. Missing Origin is allowed. Assess CSRF threat model for cookie-authenticated unsafe requests, browser and non-browser clients, proxies and same-site subdomains before changing policy.
7. **Rate limiting (needs further review):** `RateLimitMiddleware` uses process-local queues and trusts the first `x-forwarded-for` value. Review trusted-proxy handling, multi-worker limits, authentication-specific throttling and denial-of-service behavior.
8. **Tests (present but not executed here):** `backend/tests/test_auth.py` covers registration, email verification, session rotation, logout, password change, reset and test-only bypass. Add admin-role negative tests and cross-user resource ownership tests in separate scoped changes.

## Verification checklist

- Anonymous / candidate / admin / delegated-admin access to `/admin` and `/api/v1/admin/*` (expect 401 or 403 unless authorized).
- Login, refresh, logout, expired/revoked sessions, inactive users, email verification policy.
- Cross-user access to profile, uploaded files, applications, generated documents, interviews, task status.
- Unsafe methods with no Origin, disallowed Origin and forged forwarded headers.
- Session cache invalidation after logout, privilege changes and account deactivation.
- Browser smoke tests for redirect loops and correct access-denied messaging.

## Validation and scope

Two frontend files changed: one new admin authorization guard and `app/admin/layout.tsx`. Backend code and authentication policies unchanged. No tests or browser execution performed, no server deployment. The guard queries an existing admin dashboard endpoint; if this endpoint is expensive, introduce a lightweight `/admin/access` endpoint after profiling. Backend must enforce authorization independently on every admin operation. **Do not merge until frontend typecheck/build and candidate/admin/delegated-admin tests pass.**
