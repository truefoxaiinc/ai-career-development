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
