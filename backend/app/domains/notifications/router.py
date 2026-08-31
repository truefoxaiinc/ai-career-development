from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_verified_user
from app.models.entities import Notification, NotificationSetting, User
from app.schemas.common import success
from .schemas import NotificationSettingsPayload

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    user: Annotated[User, Depends(require_verified_user)],
    db: Annotated[Session, Depends(get_db)],
):
    items = list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(100)
        )
    )
    return success(
        [
            {
                "id": str(n.id),
                "kind": n.kind,
                "title": n.title,
                "body": n.body,
                "channel": n.channel,
                "read_at": n.read_at.isoformat() if n.read_at else None,
                "created_at": n.created_at.isoformat(),
            }
            for n in items
        ]
    )


@router.post("/{notification_id}/read")
def read_notification(
    notification_id: uuid.UUID,
    user: Annotated[User, Depends(require_verified_user)],
    db: Annotated[Session, Depends(get_db)],
):
    n = db.get(Notification, notification_id)
    # Deliberately return 404 for ownership failures to avoid identifier probing.
    if not n or n.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.read_at = datetime.now(UTC)
    db.commit()
    return success({"read": True})


@router.get("/settings")
def get_notification_settings(
    user: Annotated[User, Depends(require_verified_user)],
    db: Annotated[Session, Depends(get_db)],
):
    setting = db.scalar(select(NotificationSetting).where(NotificationSetting.user_id == user.id))
    if not setting:
        return success(NotificationSettingsPayload().model_dump())
    return success({key: getattr(setting, key) for key in NotificationSettingsPayload.model_fields})


@router.put("/settings")
def put_notification_settings(
    payload: NotificationSettingsPayload,
    user: Annotated[User, Depends(require_verified_user)],
    db: Annotated[Session, Depends(get_db)],
):
    setting = db.scalar(select(NotificationSetting).where(NotificationSetting.user_id == user.id))
    if not setting:
        setting = NotificationSetting(user_id=user.id)
    for key, value in payload.model_dump().items():
        setattr(setting, key, value)
    db.add(setting)
    db.commit()
    return success({key: getattr(setting, key) for key in NotificationSettingsPayload.model_fields})
