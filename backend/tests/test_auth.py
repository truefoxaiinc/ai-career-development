from conftest import register_verified

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
