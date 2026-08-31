from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.entities import Candidate,User
from conftest import register_verified,seed_profile

def test_data_export_and_account_deletion(client):
    register_verified(client);seed_profile(client)
    exported=client.get("/api/v1/privacy/export")
    assert exported.status_code==200 and exported.content.startswith(b"PK")
    deleted=client.request("DELETE","/api/v1/privacy/account",json={"confirmation":"DELETE","password":"StrongPass123!"})
    assert deleted.status_code==200
    assert client.get("/api/v1/auth/session").status_code==401

def test_admin_authorization_boundary(client):
    register_verified(client)
    assert client.get("/api/v1/admin/dashboard").status_code==403
    client.post("/api/v1/auth/logout")
    with SessionLocal() as db:
        admin=User(email="admin@example.com",password_hash=hash_password("AdminStrong123!"),is_email_verified=True,role="admin");db.add(admin);db.flush();db.add(Candidate(user_id=admin.id,name="Admin"));db.commit()
    assert client.post("/api/v1/auth/login",json={"email":"admin@example.com","password":"AdminStrong123!"}).status_code==200
    dashboard=client.get("/api/v1/admin/dashboard")
    assert dashboard.status_code==200 and "counts" in dashboard.json()["data"]
