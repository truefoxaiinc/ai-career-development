from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import BackgroundTasks
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.entities import AsyncJob


def create_task(db, user_id, kind: str, payload: dict) -> AsyncJob:
    task = AsyncJob(user_id=user_id, kind=kind, payload=payload, status="queued", progress=0)
    db.add(task); db.flush(); return task


def dispatch_task(background_tasks: BackgroundTasks, task_id: uuid.UUID) -> None:
    settings = get_settings()
    if settings.task_mode == "inline":
        background_tasks.add_task(run_task, task_id)


def update_task(db, task: AsyncJob, *, status: str | None = None, progress: int | None = None, result: dict | None = None, error_code: str | None = None):
    if status is not None: task.status=status
    if progress is not None: task.progress=max(0,min(100,progress))
    if result is not None: task.result=result
    if error_code is not None: task.error_code=error_code
    if status == "running" and task.started_at is None: task.started_at=datetime.now(UTC)
    if status in {"succeeded","failed"}: task.finished_at=datetime.now(UTC)
    db.commit()


def run_task(task_id: uuid.UUID) -> None:
    db=SessionLocal()
    try:
        task=db.get(AsyncJob,task_id)
        if not task or task.status not in {"queued","running"}: return
        update_task(db,task,status="running",progress=max(task.progress,5))
        try:
            if task.kind == "resume_parse":
                from app.domains.profiles.service import process_resume_parse_task
                process_resume_parse_task(db, task)
            elif task.kind == "document_generate":
                from app.domains.documents.service import process_document_generate_task
                process_document_generate_task(db, task)
            else:
                update_task(db,task,status="failed",progress=100,error_code="unknown_task_type")
        except Exception:
            # Do not persist exception text; it may contain resume/job PII or provider secrets.
            db.rollback()
            task=db.get(AsyncJob,task_id)
            if task: update_task(db,task,status="failed",progress=100,error_code="task_failed")
    finally:
        db.close()


def claim_and_run_one() -> bool:
    db=SessionLocal()
    try:
        task=db.scalar(select(AsyncJob).where(AsyncJob.status=="queued").order_by(AsyncJob.created_at).limit(1))
        if not task: return False
        task.status="running"; task.started_at=datetime.now(UTC); task.progress=5; db.commit(); tid=task.id
    finally:
        db.close()
    run_task(tid)
    return True
