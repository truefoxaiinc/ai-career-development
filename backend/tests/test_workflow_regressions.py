from __future__ import annotations

import uuid

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models.entities import JobPosting

from conftest import (
    generate_and_approve,
    manual_job,
    register_verified,
    seed_profile,
)


def _approved_application(client):
    register_verified(client)
    seed_profile(client)

    job = manual_job(client)

    resume = generate_and_approve(
        client,
        job["id"],
        "resume",
    )

    response = client.post(
        "/api/v1/applications",
        json={
            "job_id": job["id"],
            "resume_document_id": resume["id"],
            "cover_letter_document_id": None,
            "notes": "Regression test application",
        },
    )

    assert response.status_code == 201, response.text

    application = response.json()["data"]

    response = client.post(
        f"/api/v1/applications/{application['id']}/approve",
        json={
            "approved": True,
        },
    )

    assert response.status_code == 200, response.text

    approved = response.json()["data"]

    assert approved["approved_at"] is not None
    assert approved["applied_at"] is None

    return approved


def test_patch_cannot_set_applied_directly(client):
    application = _approved_application(
        client
    )

    response = client.patch(
        f"/api/v1/applications/{application['id']}",
        json={
            "status": "Applied",
        },
    )

    assert response.status_code == 409
    assert (
        "mark-applied"
        in response.json()["error"]["message"]
        .lower()
    )

    detail = client.get(
        f"/api/v1/applications/{application['id']}"
    )

    assert detail.status_code == 200

    data = detail.json()["data"]

    assert data["status"] != "Applied"
    assert data["applied_at"] is None


def test_screening_before_mark_applied_is_blocked(
    client,
):
    application = _approved_application(
        client
    )

    response = client.patch(
        f"/api/v1/applications/{application['id']}",
        json={
            "status": "Screening",
        },
    )

    assert response.status_code == 409

    message = (
        response.json()["error"]["message"]
        .lower()
    )

    assert "marked applied" in message

    detail = client.get(
        f"/api/v1/applications/{application['id']}"
    )

    assert detail.status_code == 200

    data = detail.json()["data"]

    assert data["applied_at"] is None
    assert data["status"] != "Screening"


def test_mark_applied_sets_timestamp_and_allows_screening(
    client,
):
    application = _approved_application(
        client
    )

    response = client.post(
        (
            f"/api/v1/applications/"
            f"{application['id']}/mark-applied"
        ),
        json={
            "confirmed": True,
        },
    )

    assert response.status_code == 200, response.text

    applied = response.json()["data"]

    assert applied["status"] == "Applied"
    assert applied["applied_at"] is not None

    applied_at = applied["applied_at"]

    response = client.patch(
        f"/api/v1/applications/{application['id']}",
        json={
            "status": "Screening",
        },
    )

    assert response.status_code == 200, response.text

    screening = response.json()["data"]

    assert screening["status"] == "Screening"
    assert screening["applied_at"] == applied_at


def test_mark_applied_is_idempotent(
    client,
):
    application = _approved_application(
        client
    )

    first = client.post(
        (
            f"/api/v1/applications/"
            f"{application['id']}/mark-applied"
        ),
        json={
            "confirmed": True,
        },
    )

    assert first.status_code == 200, first.text

    first_data = first.json()["data"]

    original_applied_at = (
        first_data["applied_at"]
    )

    screening = client.patch(
        f"/api/v1/applications/{application['id']}",
        json={
            "status": "Screening",
        },
    )

    assert screening.status_code == 200

    second = client.post(
        (
            f"/api/v1/applications/"
            f"{application['id']}/mark-applied"
        ),
        json={
            "confirmed": True,
        },
    )

    assert second.status_code == 200

    second_data = second.json()["data"]

    # Calling mark-applied again must not move Screening
    # backwards to Applied.
    assert second_data["status"] == "Screening"

    # The original application timestamp is historical
    # evidence and must not change.
    assert (
        second_data["applied_at"]
        == original_applied_at
    )


def test_applied_application_cannot_move_back_to_saved(
    client,
):
    application = _approved_application(
        client
    )

    response = client.post(
        (
            f"/api/v1/applications/"
            f"{application['id']}/mark-applied"
        ),
        json={
            "confirmed": True,
        },
    )

    assert response.status_code == 200

    response = client.patch(
        f"/api/v1/applications/{application['id']}",
        json={
            "status": "Saved",
        },
    )

    assert response.status_code == 409

    detail = client.get(
        f"/api/v1/applications/{application['id']}"
    )

    assert detail.status_code == 200

    data = detail.json()["data"]

    assert data["status"] == "Applied"
    assert data["applied_at"] is not None


def test_resume_studio_reuses_duplicate_candidate_target(
    client,
):
    register_verified(client)
    seed_profile(client)

    # Create the original private Resume Studio target.
    target_payload = {
        "title": "Staff Frontend Engineer",
        "company": "Northstar Labs",
        "description": (
            "We need 5+ years of React, TypeScript, Accessibility "
            "and GraphQL experience. Lead frontend platform work "
            "and improve performance."
        ),
        "document_type": "resume",
    }
    first_target = client.post("/api/v1/resume-studio/target", json=target_payload)
    assert first_target.status_code == 202, first_target.text
    original = {"id": first_target.json()["data"]["job_id"]}

    original_id = uuid.UUID(
        original["id"]
    )

    replay = client.post("/api/v1/resume-studio/target", json=target_payload)
    assert replay.status_code == 202, replay.text
    assert replay.json()["data"]["job_id"] == original["id"]

    # Reusing the same candidate target does not create a duplicate row.
    with SessionLocal() as db:
        count = db.scalar(
            select(func.count())
            .select_from(JobPosting)
            .where(
                JobPosting.source
                == "candidate_input",
                JobPosting.title
                == target_payload["title"],
                JobPosting.company
                == target_payload["company"],
            )
        )

    assert count == 1
