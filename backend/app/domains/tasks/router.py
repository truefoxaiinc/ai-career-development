from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import AsyncJob, User
from app.schemas.common import success

router=APIRouter(prefix="/tasks",tags=["tasks"])

@router.get("/{task_id}")
def task_status(task_id: uuid.UUID, user: Annotated[User,Depends(get_current_user)], db: Annotated[Session,Depends(get_db)]):
    task=db.get(AsyncJob,task_id)
    if not task or task.user_id!=user.id: raise HTTPException(status_code=404,detail="Task not found")
    return success({"id":str(task.id),"kind":task.kind,"status":task.status,"progress":task.progress,"result":task.result if task.status=="succeeded" else {},"error_code":task.error_code,"created_at":task.created_at.isoformat()})
