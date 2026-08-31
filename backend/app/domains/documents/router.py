from __future__ import annotations

import io
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import require_verified_user
from app.domains.jobs.service import get_job_for_user
from app.domains.tasks.service import create_task, dispatch_task
from app.models.entities import GeneratedDocument, JobPosting, User
from app.repositories.common import candidate_for_user, owned_or_404
from app.schemas.common import success
from .schemas import DocumentEditRequest, GenerateDocumentRequest
from .service import approve_document, create_edited_version, document_dict, export_docx_bytes, export_pdf_bytes

router=APIRouter(prefix="/documents",tags=["documents"])

@router.get("")
def list_documents(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)],document_type:Literal["resume","cover_letter"]|None=None):
    c=candidate_for_user(db,user);stmt=select(GeneratedDocument).where(GeneratedDocument.candidate_id==c.id)
    if document_type: stmt=stmt.where(GeneratedDocument.document_type==document_type)
    docs=list(db.scalars(stmt.order_by(GeneratedDocument.created_at.desc())));items=[]
    for d in docs: items.append(document_dict(d,db.get(JobPosting,d.job_id) if d.job_id else None))
    return success(items)

@router.post("/generate",status_code=202)
def generate(payload:GenerateDocumentRequest,background_tasks:BackgroundTasks,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    get_job_for_user(db,user,payload.job_id)
    task=create_task(db,user.id,"document_generate",{"job_id":str(payload.job_id),"document_type":payload.document_type,"template":payload.template});db.commit();dispatch_task(background_tasks,task.id)
    return success({"task_id":str(task.id),"status":"queued"})

@router.get("/{document_id}")
def get_document(document_id:uuid.UUID,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user);d=owned_or_404(db,GeneratedDocument,document_id,c.id);return success(document_dict(d,db.get(JobPosting,d.job_id) if d.job_id else None))

@router.post("/{document_id}/versions",status_code=201)
def edit_version(document_id:uuid.UUID,payload:DocumentEditRequest,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user);source=owned_or_404(db,GeneratedDocument,document_id,c.id);d=create_edited_version(db,user,source,payload.content,payload.title);return success(document_dict(d,db.get(JobPosting,d.job_id) if d.job_id else None))

@router.post("/{document_id}/approve")
def approve(document_id:uuid.UUID,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user);d=owned_or_404(db,GeneratedDocument,document_id,c.id);approve_document(db,d);return success(document_dict(d,db.get(JobPosting,d.job_id) if d.job_id else None))

@router.get("/{document_id}/download")
def download(document_id:uuid.UUID,format:Literal["pdf","docx"]=Query("pdf"),user:Annotated[User,Depends(require_verified_user)]=None,db:Annotated[Session,Depends(get_db)]=None):
    c=candidate_for_user(db,user);d=owned_or_404(db,GeneratedDocument,document_id,c.id)
    if not d.approved_at: raise HTTPException(status_code=409,detail="Document must be approved before export")
    if d.claim_report.get("unsupported_claims",0): raise HTTPException(status_code=409,detail="Document contains unsupported claims")
    data=export_pdf_bytes(d) if format=="pdf" else export_docx_bytes(d);media="application/pdf" if format=="pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document";safe="".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in d.title)[:80]
    return StreamingResponse(io.BytesIO(data),media_type=media,headers={"Content-Disposition":f'attachment; filename="{safe}.{format}"',"Cache-Control":"private, no-store"})
