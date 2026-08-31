from __future__ import annotations

import io
import json
import uuid
import zipfile
from datetime import UTC,datetime
from typing import Annotated

from fastapi import APIRouter,Depends,HTTPException,Response
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings,get_settings
from app.core.database import get_db
from app.core.security import clear_auth_cookies,require_verified_user,verify_password
from app.integrations.storage import get_storage
from app.models.entities import (
    Application,AuditLog,CareerGapAnalysis,ConsentRecord,DevelopmentRoadmap,GeneratedDocument,
    InterviewSession,JobPreference,MatchResult,Notification,NotificationSetting,ProfileEntry,
    SavedJob,STARAnswer,UploadedFile,User
)
from app.repositories.common import candidate_for_user
from app.schemas.common import success
from .schemas import ConsentPayload,DeleteAccountRequest

router=APIRouter(prefix="/privacy",tags=["privacy"])

def _rows(rows,exclude:set[str]=set()):
    out=[]
    for row in rows:
        data={}
        for col in row.__table__.columns:
            if col.name in exclude:continue
            value=getattr(row,col.name)
            if isinstance(value,(datetime,uuid.UUID)):value=str(value)
            data[col.name]=value
        out.append(data)
    return out

@router.get("/consents")
def consents(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    items=list(db.scalars(select(ConsentRecord).where(ConsentRecord.user_id==user.id).order_by(ConsentRecord.recorded_at.desc())))
    return success(_rows(items))

@router.post("/consents",status_code=201)
def record_consent(payload:ConsentPayload,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=ConsentRecord(user_id=user.id,purpose=payload.purpose,policy_version=payload.policy_version,granted=payload.granted,metadata_json={"source":"settings"});db.add(c);db.add(AuditLog(user_id=user.id,action="consent.recorded",resource_type="consent",resource_id=str(c.id),metadata_json={"purpose":payload.purpose,"granted":payload.granted}));db.commit();return success({"id":str(c.id)})

@router.get("/retention")
def retention(settings:Annotated[Settings,Depends(get_settings)]):return success({"default_retention_days":settings.retention_days,"account_deletion":"on explicit request","audit_log_note":"Security audit records may be retained in de-identified form where legally required."})

@router.get("/export")
def export_data(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user)
    payload={
        "exported_at":datetime.now(UTC).isoformat(),
        "user":{"id":str(user.id),"email":user.email,"role":user.role,"is_email_verified":user.is_email_verified,"created_at":user.created_at.isoformat()},
        "candidate":_rows([c])[0],
        "profile_entries":_rows(db.scalars(select(ProfileEntry).where(ProfileEntry.candidate_id==c.id)).all()),
        "job_preferences":_rows(db.scalars(select(JobPreference).where(JobPreference.candidate_id==c.id)).all()),
        "match_results":_rows(db.scalars(select(MatchResult).where(MatchResult.candidate_id==c.id)).all()),
        "saved_jobs":_rows(db.scalars(select(SavedJob).where(SavedJob.candidate_id==c.id)).all()),
        "generated_documents":_rows(db.scalars(select(GeneratedDocument).where(GeneratedDocument.candidate_id==c.id)).all()),
        "applications":_rows(db.scalars(select(Application).where(Application.candidate_id==c.id)).all()),
        "interview_sessions":_rows(db.scalars(select(InterviewSession).where(InterviewSession.candidate_id==c.id)).all()),
        "star_answers":_rows(db.scalars(select(STARAnswer).where(STARAnswer.candidate_id==c.id)).all()),
        "career_gap_analyses":_rows(db.scalars(select(CareerGapAnalysis).where(CareerGapAnalysis.candidate_id==c.id)).all()),
        "development_roadmaps":_rows(db.scalars(select(DevelopmentRoadmap).where(DevelopmentRoadmap.candidate_id==c.id)).all()),
        "notifications":_rows(db.scalars(select(Notification).where(Notification.user_id==user.id)).all()),
        "consents":_rows(db.scalars(select(ConsentRecord).where(ConsentRecord.user_id==user.id)).all()),
    }
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,"w",zipfile.ZIP_DEFLATED) as zf:zf.writestr("careerpilot-data.json",json.dumps(payload,ensure_ascii=False,indent=2,default=str))
    buf.seek(0)
    return StreamingResponse(buf,media_type="application/zip",headers={"Content-Disposition":'attachment; filename="careerpilot-data-export.zip"',"Cache-Control":"private, no-store"})

@router.delete("/account")
def delete_account(payload:DeleteAccountRequest,response:Response,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)],settings:Annotated[Settings,Depends(get_settings)]):
    if payload.confirmation!="DELETE":raise HTTPException(status_code=422,detail='Type "DELETE" to confirm account deletion')
    if user.password_hash and (not payload.password or not verify_password(payload.password,user.password_hash)):raise HTTPException(status_code=401,detail="Current password is required")
    c=candidate_for_user(db,user);files=list(db.scalars(select(UploadedFile).where(UploadedFile.candidate_id==c.id)))
    storage=get_storage(settings)
    for f in files:
        try:storage.delete(f.storage_key)
        except Exception:pass
    db.add(AuditLog(user_id=None,action="account.deleted",resource_type="user",resource_id=None,metadata_json={"deidentified":True}))
    db.delete(user);db.commit();clear_auth_cookies(response,settings);return success({"deleted":True})
