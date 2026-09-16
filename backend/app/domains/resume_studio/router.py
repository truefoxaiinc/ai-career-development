from __future__ import annotations

import uuid
from typing import Annotated, Literal
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.security import require_verified_user
from app.domains.documents.service import document_dict
from app.domains.jobs.service import calculate_match, get_job_for_user, match_dict
from app.domains.profiles.service import store_resume
from app.domains.tasks.service import create_task, dispatch_task
from app.models.entities import AsyncJob, GeneratedDocument, JobPosting, ProfileEntry, ResumeSuggestion, UploadedFile, User
from app.repositories.common import candidate_for_user
from app.schemas.common import success
from .schemas import SuggestionAction, TargetRequest, TemplateSelection
from .service import TEMPLATES, apply_suggestion, create_manual_target, resume_dict, suggestion_dict

router = APIRouter(prefix="/resume-studio", tags=["resume studio"])


@router.get("/overview")
def overview(user: Annotated[User, Depends(require_verified_user)], db: Annotated[Session, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings)]):
    candidate = candidate_for_user(db, user)
    files = list(db.scalars(select(UploadedFile).where(UploadedFile.candidate_id == candidate.id, UploadedFile.kind == "resume").order_by(UploadedFile.version.desc())))
    tasks = list(db.scalars(select(AsyncJob).where(AsyncJob.user_id == user.id, AsyncJob.kind == "resume_parse").order_by(AsyncJob.created_at.desc())))
    by_file = {str(t.payload.get("file_id")): t for t in tasks}
    return success({"resumes": [resume_dict(f, by_file.get(str(f.id))) for f in files], "max_upload_bytes": settings.upload_max_bytes, "supported_types": ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]})


@router.post("/resumes", status_code=202)
async def upload(background_tasks: BackgroundTasks, user: Annotated[User, Depends(require_verified_user)], db: Annotated[Session, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings)], file: UploadFile = File(...)):
    data = await file.read(settings.upload_max_bytes + 1)
    candidate = candidate_for_user(db, user)
    import hashlib
    digest = hashlib.sha256(data).hexdigest()
    existing = db.scalar(select(UploadedFile).where(UploadedFile.candidate_id == candidate.id, UploadedFile.kind == "resume", UploadedFile.sha256 == digest).order_by(UploadedFile.created_at.desc()))
    if existing:
        task = db.scalar(select(AsyncJob).where(AsyncJob.user_id == user.id, AsyncJob.kind == "resume_parse").order_by(AsyncJob.created_at.desc()))
        return success({**resume_dict(existing, task), "idempotent_replay": True})
    record = store_resume(db, user, file, data, settings)
    record.version = int(db.scalar(select(func.max(UploadedFile.version)).where(UploadedFile.candidate_id == candidate.id, UploadedFile.kind == "resume", UploadedFile.id != record.id)) or 0) + 1
    record.processing_status = "queued"
    task = create_task(db, user.id, "resume_parse", {"file_id": str(record.id)})
    db.commit(); dispatch_task(background_tasks, task.id)
    return success({**resume_dict(record, task), "idempotent_replay": False})


@router.get("/resumes/{file_id}")
def resume_status(file_id: uuid.UUID, user: Annotated[User, Depends(require_verified_user)], db: Annotated[Session, Depends(get_db)]):
    candidate = candidate_for_user(db, user); record = db.get(UploadedFile, file_id)
    if not record or record.candidate_id != candidate.id: raise HTTPException(404, "Resume not found")
    tasks = list(db.scalars(select(AsyncJob).where(AsyncJob.user_id == user.id, AsyncJob.kind == "resume_parse").order_by(AsyncJob.created_at.desc())))
    task = next((t for t in tasks if t.payload.get("file_id") == str(file_id)), None)
    return success(resume_dict(record, task))


@router.get("/resumes/{file_id}/facts")
def facts(file_id: uuid.UUID, user: Annotated[User, Depends(require_verified_user)], db: Annotated[Session, Depends(get_db)]):
    candidate = candidate_for_user(db, user); record = db.get(UploadedFile, file_id)
    if not record or record.candidate_id != candidate.id: raise HTTPException(404, "Resume not found")
    items = list(db.scalars(select(ProfileEntry).where(ProfileEntry.candidate_id == candidate.id, ProfileEntry.source_file_id == file_id).order_by(ProfileEntry.entry_type, ProfileEntry.created_at)))
    return success([{"id": str(e.id), "entry_type": e.entry_type, "label": e.label, "structured_data": e.structured_data, "confidence": e.confidence, "source_text": e.source_text, "source_location": e.structured_data.get("source_location") or e.structured_data.get("page"), "status": "confirmed" if e.verified else "pending", "verified_at": e.verified_at.isoformat() if e.verified_at else None} for e in items])


@router.post("/resumes/{file_id}/suggestions", status_code=202)
def request_suggestions(file_id: uuid.UUID, background_tasks: BackgroundTasks, user: Annotated[User, Depends(require_verified_user)], db: Annotated[Session, Depends(get_db)]):
    candidate = candidate_for_user(db, user); record = db.get(UploadedFile, file_id)
    if not record or record.candidate_id != candidate.id: raise HTTPException(404, "Resume not found")
    existing = db.scalar(select(AsyncJob).where(AsyncJob.user_id == user.id, AsyncJob.kind == "resume_suggestions", AsyncJob.status.in_(["queued", "running"])).order_by(AsyncJob.created_at.desc()))
    if existing and existing.payload.get("file_id") == str(file_id): return success({"task_id": str(existing.id), "status": existing.status, "idempotent_replay": True})
    task = create_task(db, user.id, "resume_suggestions", {"file_id": str(file_id)}); db.commit(); dispatch_task(background_tasks, task.id)
    return success({"task_id": str(task.id), "status": task.status, "idempotent_replay": False})


@router.get("/resumes/{file_id}/suggestions")
def suggestions(file_id: uuid.UUID, user: Annotated[User, Depends(require_verified_user)], db: Annotated[Session, Depends(get_db)]):
    candidate = candidate_for_user(db, user)
    items = list(db.scalars(select(ResumeSuggestion).where(ResumeSuggestion.candidate_id == candidate.id, ResumeSuggestion.source_file_id == file_id).order_by(ResumeSuggestion.created_at)))
    return success([suggestion_dict(x) for x in items])


@router.post("/suggestions/{suggestion_id}")
def handle_suggestion(suggestion_id: uuid.UUID, payload: SuggestionAction, user: Annotated[User, Depends(require_verified_user)], db: Annotated[Session, Depends(get_db)]):
    candidate = candidate_for_user(db, user); item = db.get(ResumeSuggestion, suggestion_id)
    if not item or item.candidate_id != candidate.id: raise HTTPException(404, "Suggestion not found")
    if payload.action == "dismiss":
        if item.status != "pending": raise HTTPException(409, "Suggestion has already been handled")
        item.status = "dismissed"; db.commit(); return success(suggestion_dict(item))
    doc = apply_suggestion(db, user, item, payload.document_id)
    return success({"suggestion": suggestion_dict(item), "document": document_dict(doc, db.get(JobPosting, doc.job_id) if doc.job_id else None)})


@router.get("/templates")
def templates(user: Annotated[User, Depends(require_verified_user)]):
    return success(TEMPLATES)


@router.put("/documents/{document_id}/template")
def select_template(document_id: uuid.UUID, payload: TemplateSelection, user: Annotated[User, Depends(require_verified_user)], db: Annotated[Session, Depends(get_db)]):
    candidate = candidate_for_user(db, user); source = db.get(GeneratedDocument, document_id)
    if not source or source.candidate_id != candidate.id: raise HTTPException(404, "Document not found")
    draft = GeneratedDocument(candidate_id=candidate.id, job_id=source.job_id, document_type=source.document_type, version=int(db.scalar(select(func.max(GeneratedDocument.version)).where(GeneratedDocument.candidate_id == candidate.id, GeneratedDocument.job_id == source.job_id, GeneratedDocument.document_type == source.document_type)) or 0) + 1, title=source.title, content=source.content, source_entry_ids=source.source_entry_ids, claim_report=source.claim_report, generator="template-selection", match_before=source.match_before, match_after=source.match_after, template_key=payload.template, source_file_id=source.source_file_id, source_document_id=source.id)
    db.add(draft); db.commit(); return success(document_dict(draft, db.get(JobPosting, draft.job_id) if draft.job_id else None))


@router.post("/target", status_code=202)
def target(payload: TargetRequest, background_tasks: BackgroundTasks, user: Annotated[User, Depends(require_verified_user)], db: Annotated[Session, Depends(get_db)]):
    job = get_job_for_user(db, user, payload.job_id) if payload.job_id else create_manual_target(db, user, payload.title or "Target role", payload.company or "Target company", payload.description or "")
    if not payload.job_id and len(payload.description or "") < 30: raise HTTPException(422, "A manual job description must contain at least 30 characters")
    if payload.idempotency_key:
        tasks = list(db.scalars(select(AsyncJob).where(AsyncJob.user_id == user.id, AsyncJob.kind == "document_generate").order_by(AsyncJob.created_at.desc()).limit(100)))
        prior = next((t for t in tasks if t.payload.get("idempotency_key") == payload.idempotency_key), None)
        if prior: return success({"task_id": str(prior.id), "status": prior.status, "job_id": str(job.id), "idempotent_replay": True})
    task = create_task(db, user.id, "document_generate", {"job_id": str(job.id), "document_type": payload.document_type, "template": payload.template, "source_file_id": str(payload.source_file_id) if payload.source_file_id else None, "source_document_id": str(payload.source_document_id) if payload.source_document_id else None, "idempotency_key": payload.idempotency_key})
    db.commit(); dispatch_task(background_tasks, task.id)
    return success({"task_id": str(task.id), "status": task.status, "job_id": str(job.id), "idempotent_replay": False})


@router.get("/jobs/{job_id}/match")
def job_match(job_id: uuid.UUID, user: Annotated[User, Depends(require_verified_user)], db: Annotated[Session, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings)]):
    job = get_job_for_user(db, user, job_id); result = calculate_match(db, user, job, settings)
    data = match_dict(result)
    return success({"score": data["score"], "matching_skills": data["strong"], "missing_keywords": data["missing"], "experience_alignment": data["factors"].get("experience"), "education_alignment": data["factors"].get("education"), "recommended_changes": data["partial"]})
