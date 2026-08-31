from __future__ import annotations

import os
from pathlib import Path

TEST_DB = Path(__file__).parent / "careerpilot-test.db"
TEST_STORAGE = Path(__file__).parent / ".storage"
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["LOCAL_STORAGE_DIR"] = str(TEST_STORAGE)
os.environ["TASK_MODE"] = "inline"
os.environ["ENABLE_DEV_JOB_PROVIDER"] = "true"
os.environ["JWT_SECRET"] = "test-secret-at-least-thirty-two-bytes-long-123456"

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.database import Base, engine
import app.models.entities  # noqa: F401
from app.main import app


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    TEST_STORAGE.mkdir(parents=True, exist_ok=True)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register_verified(client: TestClient, email: str = "candidate@example.com", password: str = "StrongPass123!"):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": password, "name": "Test Candidate", "accept_terms": True, "accept_privacy": True})
    assert r.status_code == 201, r.text
    token = r.json()["data"]["dev_verification_token"]
    assert token
    verify = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert verify.status_code == 200, verify.text
    return r.json()["data"]["user"]


def seed_profile(client: TestClient):
    client.patch("/api/v1/profile", json={"headline": "Senior Product Engineer", "location": "Bengaluru, India", "profile_summary": "Product engineer focused on React platforms and accessible systems."})
    entries = [
        ("skill", "React", "React used in production product and platform work."),
        ("skill", "TypeScript", "TypeScript used in production product and platform work."),
        ("skill", "Accessibility", "Implemented accessible UI primitives."),
        ("skill", "PostgreSQL", "Used PostgreSQL in product systems."),
        ("experience", "Senior Product Engineer at Clearline since 2023", "Senior Product Engineer at Clearline since 2023."),
        ("achievement", "Reduced checkout p95 latency by 34%", "Cut checkout p95 from 1.8s to 1.19s after redesigning cache behavior."),
        ("education", "B.Tech in Computer Science", "B.Tech in Computer Science, PES University, 2014-2018."),
    ]
    for kind, label, source in entries:
        r = client.post("/api/v1/profile/entries", json={"entry_type": kind, "label": label, "structured_data": {"raw": source}, "source_text": source})
        assert r.status_code == 201, r.text


def manual_job(client: TestClient):
    r = client.post("/api/v1/jobs/manual", json={"title": "Staff Frontend Engineer", "company": "Northstar Labs", "location": "Bengaluru", "description": "We need 5+ years of React, TypeScript, Accessibility and GraphQL experience. Lead frontend platform work and improve performance.", "apply_url": "https://careers.example.com/job/123"})
    assert r.status_code == 201, r.text
    return r.json()["data"]


def generate_and_approve(client: TestClient, job_id: str, kind: str):
    r = client.post("/api/v1/documents/generate", json={"job_id": job_id, "document_type": kind, "template": "ats"})
    assert r.status_code == 202, r.text
    task = client.get(f"/api/v1/tasks/{r.json()['data']['task_id']}").json()["data"]
    assert task["status"] == "succeeded", task
    doc_id = task["result"]["document_id"]
    doc = client.get(f"/api/v1/documents/{doc_id}").json()["data"]
    assert doc["claim_report"]["unsupported_claims"] == 0, doc["claim_report"]
    approved = client.post(f"/api/v1/documents/{doc_id}/approve")
    assert approved.status_code == 200, approved.text
    return approved.json()["data"]
