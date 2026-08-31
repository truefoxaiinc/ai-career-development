from __future__ import annotations

import uuid
from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import Candidate, User

T = TypeVar("T")


def candidate_for_user(db: Session, user: User) -> Candidate:
    candidate = user.candidate
    if candidate is None:
        candidate = Candidate(user_id=user.id)
        db.add(candidate)
        db.flush()
    return candidate


def owned_or_404(db: Session, model, object_id: uuid.UUID, candidate_id: uuid.UUID, owner_field: str = "candidate_id"):
    obj = db.get(model, object_id)
    if obj is None or getattr(obj, owner_field, None) != candidate_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return obj
