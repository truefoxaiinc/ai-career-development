from conftest import register_verified


def test_registration_requires_email_verification_before_session(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "unverified@example.com",
        "password": "StrongPass123!",
        "name": "Unverified Candidate",
        "accept_terms": True,
        "accept_privacy": True,
    })
    assert response.status_code == 201
    assert "cp_access" not in client.cookies
    assert "cp_refresh" not in client.cookies
    assert client.get("/api/v1/auth/session").status_code == 401

    login = client.post("/api/v1/auth/login", json={
        "email": "unverified@example.com",
        "password": "StrongPass123!",
    })
    assert login.status_code == 200
    assert login.json()["data"]["email_verification_required"] is True
    assert "cp_access" not in client.cookies

    token = response.json()["data"]["dev_verification_token"]
    assert client.post("/api/v1/auth/verify-email", json={"token": token}).status_code == 200
    assert client.post("/api/v1/auth/login", json={
        "email": "unverified@example.com",
        "password": "StrongPass123!",
    }).status_code == 200
    assert client.get("/api/v1/auth/session").status_code == 200


def test_registration_rejects_invalid_duplicate_and_weak_password(client):
    payload = {"email": "invalid", "password": "StrongPass123!", "name": "Candidate", "accept_terms": True, "accept_privacy": True}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 422
    payload["email"] = "candidate@example.com"
    payload["password"] = "short"
    assert client.post("/api/v1/auth/register", json=payload).status_code == 422
    register_verified(client)
    payload["password"] = "StrongPass123!"
    assert client.post("/api/v1/auth/register", json=payload).status_code == 409


def test_invalid_login_and_protected_api_require_authentication(client):
    assert client.get("/api/v1/profile").status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "missing@example.com", "password": "wrong-password"}).status_code == 401
    register_verified(client)
    client.post("/api/v1/auth/logout")
    assert client.get("/api/v1/profile").status_code == 401
    assert client.get("/api/v1/auth/session").status_code == 401


def test_refresh_rotates_persistent_session_and_logout_invalidates_it(client):
    register_verified(client)
    first_refresh = client.cookies.get("cp_refresh")
    first_access = client.cookies.get("cp_access")
    assert first_refresh
    assert first_access
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 200
    assert client.cookies.get("cp_refresh") != first_refresh
    assert client.get("/api/v1/profile", headers={"Authorization": f"Bearer {first_access}"}).status_code == 401
    assert client.get("/api/v1/auth/session").status_code == 200
    latest_access = client.cookies.get("cp_access")
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.get("/api/v1/profile").status_code == 401
    assert client.get("/api/v1/profile", headers={"Authorization": f"Bearer {latest_access}"}).status_code == 401


def test_password_change_revokes_old_access_and_keeps_current_user_signed_in(client):
    register_verified(client)
    old_access = client.cookies.get("cp_access")
    response = client.post("/api/v1/auth/change-password", json={
        "current_password": "StrongPass123!",
        "new_password": "ChangedPass123!",
    })
    assert response.status_code == 200
    assert client.get("/api/v1/auth/session").status_code == 200
    assert client.get("/api/v1/profile", headers={"Authorization": f"Bearer {old_access}"}).status_code == 401


def test_registration_login_reset_and_session(client):
    register_verified(client)
    assert client.get("/api/v1/auth/session").status_code == 200
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.get("/api/v1/auth/session").status_code == 401
    login = client.post("/api/v1/auth/login", json={"email":"candidate@example.com","password":"StrongPass123!"})
    assert login.status_code == 200
    forgot = client.post("/api/v1/auth/forgot-password", json={"email":"candidate@example.com"})
    token = forgot.json()["data"]["dev_reset_token"]
    reset = client.post("/api/v1/auth/reset-password", json={"token":token,"new_password":"ChangedPass123!"})
    assert reset.status_code == 200
    assert client.post("/api/v1/auth/login", json={"email":"candidate@example.com","password":"ChangedPass123!"}).status_code == 200

def test_resend_verification_cooldown_and_unknown_account(client, monkeypatch):
    from datetime import UTC, datetime, timedelta
    from sqlalchemy import select
    from app.core.database import SessionLocal
    from app.models.entities import EmailToken, User
    from app.domains.auth import service

    sent = []
    monkeypatch.setattr(service, "_send_account_email", lambda *args: sent.append(args))
    payload = {"email": "retry@example.com", "password": "StrongPass123!",
               "name": "Retry", "accept_terms": True, "accept_privacy": True}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    assert client.post("/api/v1/auth/resend-verification", json={"email": "unknown@example.com"}).status_code == 202
    assert client.post("/api/v1/auth/resend-verification", json={"email": "retry@example.com"}).status_code == 202
    assert len(sent) == 1  # registration email only; resend throttled

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "retry@example.com"))
        token = db.scalar(select(EmailToken).where(EmailToken.user_id == user.id))
        token.created_at = datetime.now(UTC) - timedelta(minutes=3)
        db.commit()

    assert client.post("/api/v1/auth/resend-verification", json={"email": "retry@example.com"}).status_code == 202
    assert len(sent) == 2
    assert client.post("/api/v1/auth/resend-verification", json={"email": "retry@example.com"}).status_code == 202
    assert len(sent) == 2


def test_graph_email_sender_success_and_failure(monkeypatch):
    import pytest
    import httpx
    from fastapi import HTTPException
    from app.core.config import Settings
    from app.domains.auth.service import _send_account_email

    requests = []
    def handler(request):
        requests.append(request)
        if request.url.path.endswith("/token"):
            return httpx.Response(200, json={"access_token": "fake-token"})
        return httpx.Response(202)
    transport = httpx.MockTransport(handler)
    real_client = httpx.Client
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: real_client(transport=transport))
    settings = Settings(environment="production", careerpilot_email_provider="microsoft_graph",
        careerpilot_graph_tenant_id="tenant", careerpilot_graph_client_id="client",
        careerpilot_graph_client_secret="fake-secret", careerpilot_graph_sender="sender@example.com")
    _send_account_email(settings, "receiver@example.com", "Subject", "Body")
    assert len(requests) == 2
    assert requests[1].url.path.endswith("/users/sender@example.com/sendMail")
    assert requests[1].headers["Authorization"] == "Bearer fake-token"

    def reject(request):
        return httpx.Response(403)
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: real_client(transport=httpx.MockTransport(reject)))
    with pytest.raises(HTTPException) as exc:
        _send_account_email(settings, "receiver@example.com", "Subject", "Body")
    assert exc.value.status_code == 503
    assert "fake-secret" not in exc.value.detail


def test_staging_can_skip_email_verification(client, monkeypatch):
    from app.core.config import get_settings
    from app.domains.auth import service
    settings = get_settings()
    monkeypatch.setattr(settings, "careerpilot_require_email_verification", False)
    sent = []
    monkeypatch.setattr(service, "_send_account_email", lambda *args: sent.append(args))
    payload = {"email": "staging@example.com", "password": "StrongPass123!",
               "name": "Staging Candidate", "accept_terms": True, "accept_privacy": True}
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    assert response.json()["data"]["email_verification_required"] is False
    assert response.json()["data"]["dev_verification_token"] is None
    assert response.json()["data"]["user"]["is_email_verified"] is True
    assert sent == []
    login = client.post("/api/v1/auth/login", json={"email": payload["email"], "password": payload["password"]})
    assert login.status_code == 200
    assert login.json()["data"]["email_verification_required"] is False
    assert client.get("/api/v1/auth/session").status_code == 200
    assert client.post("/api/v1/auth/resend-verification", json={"email": payload["email"]}).status_code == 202
    assert sent == []


def test_staging_existing_unverified_user_can_login(client, monkeypatch):
    from app.core.config import get_settings
    response = client.post("/api/v1/auth/register", json={
        "email": "existing@example.com", "password": "StrongPass123!",
        "name": "Existing Candidate", "accept_terms": True, "accept_privacy": True})
    assert response.status_code == 201
    monkeypatch.setattr(get_settings(), "careerpilot_require_email_verification", False)
    login = client.post("/api/v1/auth/login", json={
        "email": "existing@example.com", "password": "StrongPass123!"})
    assert login.status_code == 200
    assert login.json()["data"]["email_verification_required"] is False
    assert client.get("/api/v1/auth/session").status_code == 200


def test_production_rejects_email_verification_bypass():
    import pytest
    from app.core.config import Settings
    with pytest.raises(RuntimeError, match="bypass is not allowed in production"):
        Settings(environment="production", careerpilot_require_email_verification=False).validate_runtime()
