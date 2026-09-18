from __future__ import annotations

import uuid
from typing import Annotated,Literal

from fastapi import APIRouter,BackgroundTasks,Depends,Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings,get_settings
from app.core.database import get_db
from app.core.security import require_verified_user
from app.domains.tasks.service import create_task,dispatch_task
from app.models.entities import SavedJob,User
from app.repositories.common import candidate_for_user
from app.schemas.common import success
from .schemas import DiscoverJobsRequest,ManualJobRequest,SaveJobRequest
from .service import _job_dict,calculate_match,create_manual_job,get_job_for_user,match_dict,recommendations,save_job,search_jobs

router=APIRouter(prefix="/jobs",tags=["jobs"])

@router.get("")
def search(q:str="",location:str="",source:str="",sort:Literal["recent","title"]="recent",page:int=Query(1,ge=1),page_size:int=Query(20,ge=1,le=100),user:Annotated[User,Depends(require_verified_user)]=None,db:Annotated[Session,Depends(get_db)]=None): return success(search_jobs(db,user,q,location,source,sort,page,page_size))

@router.post("/manual",status_code=201)
def manual(payload:ManualJobRequest,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]): return success(_job_dict(create_manual_job(db,user,payload)))

@router.post("/discover",status_code=202)
def discover(payload:DiscoverJobsRequest,background_tasks:BackgroundTasks,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    task=create_task(db,user.id,"job_discovery",payload.model_dump());db.commit();dispatch_task(background_tasks,task.id)
    return success({"task_id":str(task.id),"status":"queued"})

@router.get("/recommendations")
def recommend(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)],settings:Annotated[Settings,Depends(get_settings)],limit:int=Query(20,ge=1,le=50)): return success(recommendations(db,user,settings,limit))

@router.get("/saved")
def saved(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user); records=list(db.scalars(select(SavedJob).where(SavedJob.candidate_id==c.id).order_by(SavedJob.created_at.desc())));items=[]
    for s in records:
        job=get_job_for_user(db,user,s.job_id); items.append({**_job_dict(job),"saved_id":str(s.id),"note":s.note})
    return success(items)

@router.get("/{job_id}")
def detail(job_id:uuid.UUID,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]): return success(_job_dict(get_job_for_user(db,user,job_id)))

@router.get("/{job_id}/match")
def match(job_id:uuid.UUID,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)],settings:Annotated[Settings,Depends(get_settings)]):
    job=get_job_for_user(db,user,job_id); return success(match_dict(calculate_match(db,user,job,settings),job))

@router.post("/{job_id}/save",status_code=201)
def save(job_id:uuid.UUID,payload:SaveJobRequest,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    job=get_job_for_user(db,user,job_id); s=save_job(db,user,job,payload.note); return success({"id":str(s.id),"job_id":str(job.id),"saved":True})

@router.delete("/{job_id}/save")
def unsave(job_id:uuid.UUID,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user); s=db.scalar(select(SavedJob).where(SavedJob.candidate_id==c.id,SavedJob.job_id==job_id))
    if s: db.delete(s);db.commit()
    return success({"job_id":str(job_id),"saved":False})
