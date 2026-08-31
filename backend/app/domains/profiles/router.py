from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.security import require_verified_user
from app.domains.tasks.service import create_task, dispatch_task
from app.models.entities import JobPreference, ProfileEntry, User
from app.repositories.common import candidate_for_user
from app.schemas.common import success
from .schemas import CandidateUpdate, JobPreferencePayload, ProfileEntryCreate, ProfileEntryUpdate, VerificationRequest
from .service import add_manual_entry, profile_analysis, profile_view, store_resume, update_candidate, verify_entries

router=APIRouter(tags=["profile"])

@router.get("/profile")
def get_profile(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]): return success(profile_view(db,user))

@router.patch("/profile")
def patch_profile(payload:CandidateUpdate,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]): update_candidate(db,user,payload.model_dump(exclude_unset=True)); return success(profile_view(db,user))

@router.post("/profile/entries",status_code=201)
def create_entry(payload:ProfileEntryCreate,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    e=add_manual_entry(db,user,payload); return success({"id":str(e.id),"verified":e.verified})

@router.patch("/profile/entries/{entry_id}")
def update_entry(entry_id:uuid.UUID,payload:ProfileEntryUpdate,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user); e=db.get(ProfileEntry,entry_id)
    if not e or e.candidate_id!=c.id: raise HTTPException(status_code=404,detail="Profile entry not found")
    for k,v in payload.model_dump(exclude_unset=True).items(): setattr(e,k,v)
    e.verified=True; db.commit(); return success({"id":str(e.id),"updated":True})

@router.delete("/profile/entries/{entry_id}")
def delete_entry(entry_id:uuid.UUID,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user); e=db.get(ProfileEntry,entry_id)
    if not e or e.candidate_id!=c.id: raise HTTPException(status_code=404,detail="Profile entry not found")
    db.delete(e); db.commit(); return success({"deleted":True})

@router.post("/profile/resume",status_code=202)
async def upload_resume(background_tasks:BackgroundTasks,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)],settings:Annotated[Settings,Depends(get_settings)],file:UploadFile=File(...)):
    data=await file.read(settings.upload_max_bytes+1); record=store_resume(db,user,file,data,settings); task=create_task(db,user.id,"resume_parse",{"file_id":str(record.id)}); db.commit(); dispatch_task(background_tasks,task.id)
    return success({"task_id":str(task.id),"file_id":str(record.id),"status":"queued"})

@router.get("/profile/extracted")
def extracted_entries(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user); entries=list(db.scalars(select(ProfileEntry).where(ProfileEntry.candidate_id==c.id,ProfileEntry.verified.is_(False)).order_by(ProfileEntry.confidence,ProfileEntry.created_at)))
    return success([{"id":str(e.id),"entry_type":e.entry_type,"label":e.label,"structured_data":e.structured_data,"confidence":e.confidence,"source_text":e.source_text} for e in entries])

@router.post("/profile/verify")
def verify(payload:VerificationRequest,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]): return success(verify_entries(db,user,payload.decisions))

@router.get("/profile/analysis")
def analysis(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]): return success(profile_analysis(db,user))

@router.get("/preferences")
def get_preferences(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user); p=db.scalar(select(JobPreference).where(JobPreference.candidate_id==c.id))
    if not p: return success({"target_titles":[],"industries":[],"locations":[],"work_modes":[],"salary_min":None,"salary_currency":None,"employment_types":[],"relocation_willing":False,"experience_levels":[],"preferred_companies":[],"alert_frequency":"weekly"})
    return success({k:getattr(p,k) for k in JobPreferencePayload.model_fields})

@router.put("/preferences")
def put_preferences(payload:JobPreferencePayload,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user); p=db.scalar(select(JobPreference).where(JobPreference.candidate_id==c.id)) or JobPreference(candidate_id=c.id)
    for k,v in payload.model_dump().items(): setattr(p,k,v)
    db.add(p); db.commit(); return success({k:getattr(p,k) for k in JobPreferencePayload.model_fields})
