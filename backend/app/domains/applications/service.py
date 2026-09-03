from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    Application,
    AuditLog,
    GeneratedDocument,
    JobPosting,
    ProfileEntry,
    User,
)
from app.repositories.common import candidate_for_user


STATUSES = [
    "Recommended",
    "Saved",
    "Resume generated",
    "Applied",
    "Screening",
    "Interview",
    "Technical interview",
    "Offer",
    "Rejected",
    "Withdrawn",
]

PRE_APPLIED_STATUSES = {
    "Recommended",
    "Saved",
    "Resume generated",
}

POST_APPLIED_STATUSES = {
    "Screening",
    "Interview",
    "Technical interview",
    "Offer",
    "Rejected",
}


def _iso_utc(value: datetime | None) -> str | None:
    """
    Serialize timestamps consistently as UTC.

    SQLite can return timezone-aware DateTime columns as naive values,
    so attach UTC when tzinfo is missing before calling isoformat().
    """
    if value is None:
        return None

    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    else:
        value = value.astimezone(UTC)

    return value.isoformat()


def _doc_owned(
    db: Session,
    candidate_id: uuid.UUID,
    doc_id: uuid.UUID | None,
    job_id: uuid.UUID,
    kind: str,
) -> GeneratedDocument | None:
    if not doc_id:
        return None

    doc = db.get(
        GeneratedDocument,
        doc_id,
    )

    if (
        not doc
        or doc.candidate_id != candidate_id
        or doc.document_type != kind
        or doc.job_id != job_id
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {kind} document",
        )

    return doc


def create_or_update_application(
    db: Session,
    user: User,
    payload,
) -> Application:
    candidate = candidate_for_user(
        db,
        user,
    )

    job = db.get(
        JobPosting,
        payload.job_id,
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found",
        )

    resume = _doc_owned(
        db,
        candidate.id,
        payload.resume_document_id,
        job.id,
        "resume",
    )

    cover = _doc_owned(
        db,
        candidate.id,
        payload.cover_letter_document_id,
        job.id,
        "cover_letter",
    )

    app = db.scalar(
        select(Application).where(
            Application.candidate_id
            == candidate.id,
            Application.job_id
            == job.id,
        )
    )

    if not app:
        app = Application(
            candidate_id=candidate.id,
            job_id=job.id,
            status=(
                "Resume generated"
                if resume
                else "Saved"
            ),
            notes=payload.notes,
        )

        db.add(app)

    else:
        # The submitted package must remain immutable after the
        # candidate confirms that the application was sent.
        if app.applied_at:
            if (
                resume
                and resume.id
                != app.resume_document_id
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Cannot replace the resume after "
                        "the application has been marked applied"
                    ),
                )

            if (
                cover
                and cover.id
                != app.cover_letter_document_id
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Cannot replace the cover letter after "
                        "the application has been marked applied"
                    ),
                )

    attachment_changed = False

    if (
        resume
        and resume.id
        != app.resume_document_id
    ):
        app.resume_document_id = resume.id
        attachment_changed = True

    if (
        cover
        and cover.id
        != app.cover_letter_document_id
    ):
        app.cover_letter_document_id = cover.id
        attachment_changed = True

    # Changing the package invalidates previous package approval.
    # The candidate must approve the exact new document versions.
    if (
        attachment_changed
        and app.approved_at
        and not app.applied_at
    ):
        app.approved_at = None

    if (
        resume
        and not app.applied_at
        and app.status
        in {"Recommended", "Saved"}
    ):
        app.status = "Resume generated"

    app.notes = payload.notes

    db.commit()

    return app


def application_dict(
    db: Session,
    app: Application,
) -> dict:
    job = db.get(
        JobPosting,
        app.job_id,
    )

    resume = (
        db.get(
            GeneratedDocument,
            app.resume_document_id,
        )
        if app.resume_document_id
        else None
    )

    cover = (
        db.get(
            GeneratedDocument,
            app.cover_letter_document_id,
        )
        if app.cover_letter_document_id
        else None
    )

    return {
        "id": str(app.id),
        "job_id": str(app.job_id),
        "status": app.status,
        "notes": app.notes,
        "outcome": app.outcome,
        "approved_at": _iso_utc(
            app.approved_at
        ),
        "applied_at": _iso_utc(
            app.applied_at
        ),
        "updated_at": _iso_utc(
            app.updated_at
        ),
        "job": (
            {
                "title": job.title,
                "company": job.company,
                "location": job.location,
                "apply_url": job.apply_url,
            }
            if job
            else None
        ),
        "resume": (
            {
                "id": str(resume.id),
                "version": resume.version,
                "approved": bool(
                    resume.approved_at
                ),
                "claim_status": (
                    resume.claim_report.get(
                        "status"
                    )
                ),
            }
            if resume
            else None
        ),
        "cover_letter": (
            {
                "id": str(cover.id),
                "version": cover.version,
                "approved": bool(
                    cover.approved_at
                ),
                "claim_status": (
                    cover.claim_report.get(
                        "status"
                    )
                ),
            }
            if cover
            else None
        ),
    }


def update_application(
    db: Session,
    user: User,
    app: Application,
    fields: dict,
) -> Application:
    target_status = fields.get(
        "status"
    )

    if target_status is not None:
        if target_status not in STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid application status",
            )

        # Applied is special because it records explicit candidate
        # confirmation and sets applied_at.
        if target_status == "Applied":
            raise HTTPException(
                status_code=409,
                detail=(
                    "Use mark-applied with explicit confirmation"
                ),
            )

        # Any recruiting stage after submission requires evidence that
        # the candidate actually marked the application as submitted.
        if (
            target_status
            in POST_APPLIED_STATUSES
            and not app.applied_at
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Application must be marked applied before "
                    f"moving to {target_status}"
                ),
            )

        # Once submitted, do not allow the workflow to move back into
        # a pre-submission state.
        if (
            app.applied_at
            and target_status
            in PRE_APPLIED_STATUSES
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "An applied application cannot return "
                    "to a pre-application status"
                ),
            )

    previous_status = app.status

    for key, value in fields.items():
        setattr(
            app,
            key,
            value,
        )

    if (
        target_status is not None
        and target_status
        != previous_status
    ):
        db.add(
            AuditLog(
                user_id=user.id,
                action="application.status_changed",
                resource_type="application",
                resource_id=str(app.id),
                metadata_json={
                    "from": previous_status,
                    "to": target_status,
                },
            )
        )

    db.commit()

    return app


def approve_application(
    db: Session,
    user: User,
    app: Application,
    approved: bool,
) -> Application:
    # Once submitted, package approval is historical evidence and
    # should not be revoked or rewritten.
    if app.applied_at:
        if (
            approved
            and app.approved_at
        ):
            return app

        raise HTTPException(
            status_code=409,
            detail=(
                "Application approval cannot be changed "
                "after the application has been marked applied"
            ),
        )

    if not approved:
        app.approved_at = None
        db.commit()
        return app

    docs = []

    if app.resume_document_id:
        docs.append(
            db.get(
                GeneratedDocument,
                app.resume_document_id,
            )
        )

    if app.cover_letter_document_id:
        docs.append(
            db.get(
                GeneratedDocument,
                app.cover_letter_document_id,
            )
        )

    if not docs:
        raise HTTPException(
            status_code=409,
            detail=(
                "Attach at least one document "
                "before application approval"
            ),
        )

    for doc in docs:
        if (
            not doc
            or not doc.approved_at
            or doc.claim_report.get(
                "unsupported_claims",
                0,
            )
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Every attached document must be "
                    "claim-verified and approved"
                ),
            )

    app.approved_at = datetime.now(
        UTC
    )

    db.add(
        AuditLog(
            user_id=user.id,
            action="application.approved",
            resource_type="application",
            resource_id=str(app.id),
            metadata_json={
                "resume_document_id": (
                    str(
                        app.resume_document_id
                    )
                    if app.resume_document_id
                    else None
                ),
                "cover_letter_document_id": (
                    str(
                        app.cover_letter_document_id
                    )
                    if app.cover_letter_document_id
                    else None
                ),
            },
        )
    )

    db.commit()

    return app


def mark_applied(
    db: Session,
    user: User,
    app: Application,
    confirmed: bool,
) -> Application:
    if not confirmed:
        raise HTTPException(
            status_code=400,
            detail=(
                "Explicit candidate confirmation "
                "is required"
            ),
        )

    # Idempotent: do not replace the original application timestamp
    # or move a later recruiting stage backwards to Applied.
    if app.applied_at:
        return app

    if not app.approved_at:
        raise HTTPException(
            status_code=409,
            detail=(
                "Application package must "
                "be approved first"
            ),
        )

    app.status = "Applied"
    app.applied_at = datetime.now(
        UTC
    )

    db.add(
        AuditLog(
            user_id=user.id,
            action="application.marked_applied",
            resource_type="application",
            resource_id=str(app.id),
            metadata_json={
                "submission_mode": (
                    "manual_candidate_confirmation"
                )
            },
        )
    )

    db.commit()

    return app


def draft_answers(
    db: Session,
    user: User,
    questions: list[str],
) -> list[dict]:
    candidate = candidate_for_user(
        db,
        user,
    )

    entries = list(
        db.scalars(
            select(ProfileEntry).where(
                ProfileEntry.candidate_id
                == candidate.id,
                ProfileEntry.verified.is_(
                    True
                ),
            )
        )
    )

    sources = [
        (
            entry,
            _tokens(
                entry.label
                + " "
                + (
                    entry.source_text
                    or ""
                )
                + " "
                + str(
                    entry.structured_data
                )
            ),
        )
        for entry in entries
    ]

    answers = []

    for question in questions:
        question_tokens = _tokens(
            question
        )

        ranked = sorted(
            sources,
            key=lambda item: len(
                question_tokens
                & item[1]
            ),
            reverse=True,
        )

        chosen = [
            item[0]
            for item in ranked
            if len(
                question_tokens
                & item[1]
            )
            > 0
        ][:2]

        if not chosen:
            answers.append(
                {
                    "question": question,
                    "answer": (
                        "CareerPilot could not ground an answer "
                        "in verified profile facts. Add or verify "
                        "relevant experience before using "
                        "AI-assisted answers."
                    ),
                    "source_entry_ids": [],
                    "status": "needs_input",
                }
            )

        else:
            facts = [
                (
                    entry.source_text
                    or entry.structured_data.get(
                        "raw"
                    )
                    or entry.label
                )
                for entry in chosen
            ]

            answers.append(
                {
                    "question": question,
                    "answer": (
                        "Based on my verified profile: "
                        + " ".join(
                            str(fact)
                            for fact in facts
                        )
                    ),
                    "source_entry_ids": [
                        str(entry.id)
                        for entry in chosen
                    ],
                    "status": "grounded_draft",
                }
            )

    return answers


def _tokens(
    text: str,
) -> set[str]:
    stop_words = {
        "the",
        "and",
        "for",
        "with",
        "your",
        "you",
        "our",
        "are",
        "was",
        "what",
        "how",
        "why",
        "tell",
        "about",
    }

    return {
        token
        for token in re.findall(
            r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}",
            text.lower(),
        )
        if token not in stop_words
    }
