from __future__ import annotations

import uuid
from typing import Annotated
from fastapi import APIRouter,Depends,HTTPException,Query
from sqlalchemy import func,select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_verified_user
from app.models.entities import InterviewSession,JobPosting,STARAnswer,User
from app.repositories.common import candidate_for_user,owned_or_404
from app.schemas.common import success
from .schemas import AnswerRequest,SessionCreate,STARPayload
from .service import add_answer,complete_session,create_session,generate_questions,session_dict

router=APIRouter(prefix="/interviews",tags=["interviews"])

@router.get("/dashboard")
def dashboard(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
 c=candidate_for_user(db,user);sessions=list(db.scalars(select(InterviewSession).where(InterviewSession.candidate_id==c.id).order_by(InterviewSession.created_at.desc()).limit(8)));stars=db.scalar(select(func.count()).select_from(STARAnswer).where(STARAnswer.candidate_id==c.id)) or 0;return success({"recent_sessions":[session_dict(s) for s in sessions],"star_answer_count":stars,"voice_ready_architecture":True,"voice_enabled":False})

@router.get("/questions")
def questions(job_id:uuid.UUID|None=None,count:int=Query(10,ge=3,le=20),user:Annotated[User,Depends(require_verified_user)]=None,db:Annotated[Session,Depends(get_db)]=None):
 job=db.get(JobPosting,job_id) if job_id else None
 if job_id and not job:raise HTTPException(status_code=404,detail="Job not found")
 return success(generate_questions(db,user,job,count))

@router.post("/sessions",status_code=201)
def start(payload:SessionCreate,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):return success(session_dict(create_session(db,user,payload.job_id,payload.question_count)))

@router.get("/sessions/{session_id}")
def get_session(session_id:uuid.UUID,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);return success(session_dict(owned_or_404(db,InterviewSession,session_id,c.id)))

@router.post("/sessions/{session_id}/answers")
def answer(session_id:uuid.UUID,payload:AnswerRequest,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);s=owned_or_404(db,InterviewSession,session_id,c.id);return success(session_dict(add_answer(db,s,payload.question_id,payload.answer)))

@router.post("/sessions/{session_id}/complete")
def complete(session_id:uuid.UUID,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);s=owned_or_404(db,InterviewSession,session_id,c.id);return success(session_dict(complete_session(db,s)))

@router.get("/star")
def list_star(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);items=list(db.scalars(select(STARAnswer).where(STARAnswer.candidate_id==c.id).order_by(STARAnswer.updated_at.desc())));return success([{"id":str(x.id),"theme":x.theme,"title":x.title,"situation":x.situation,"task":x.task,"action":x.action,"result":x.result,"tags":x.tags} for x in items])

@router.post("/star",status_code=201)
def create_star(payload:STARPayload,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);x=STARAnswer(candidate_id=c.id,**payload.model_dump());db.add(x);db.commit();return success({"id":str(x.id)})

@router.put("/star/{answer_id}")
def update_star(answer_id:uuid.UUID,payload:STARPayload,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);x=owned_or_404(db,STARAnswer,answer_id,c.id);[setattr(x,k,v) for k,v in payload.model_dump().items()];db.commit();return success({"id":str(x.id),"updated":True})

@router.delete("/star/{answer_id}")
def delete_star(answer_id:uuid.UUID,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);x=owned_or_404(db,STARAnswer,answer_id,c.id);db.delete(x);db.commit();return success({"deleted":True})
