from __future__ import annotations
import uuid
from typing import Annotated
from fastapi import APIRouter,Depends,HTTPException,Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_verified_user
from app.models.entities import CareerGapAnalysis,DevelopmentRoadmap,User
from app.repositories.common import candidate_for_user,owned_or_404
from app.schemas.common import success
from .schemas import GapAnalysisRequest,RoadmapRequest
from .service import analysis_dict,make_roadmap,roadmap_dict,run_gap_analysis

router=APIRouter(prefix="/career",tags=["career intelligence"])

@router.get("/gaps")
def list_gaps(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);items=list(db.scalars(select(CareerGapAnalysis).where(CareerGapAnalysis.candidate_id==c.id).order_by(CareerGapAnalysis.created_at.desc())));return success([analysis_dict(x) for x in items])

@router.post("/gaps",status_code=201)
def create_gap(payload:GapAnalysisRequest,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):return success(analysis_dict(run_gap_analysis(db,user,payload.target_role,payload.sample_size)))

@router.get("/skills-market")
def skills_market(analysis_id:uuid.UUID|None=None,user:Annotated[User,Depends(require_verified_user)]=None,db:Annotated[Session,Depends(get_db)]=None):
 c=candidate_for_user(db,user);a=owned_or_404(db,CareerGapAnalysis,analysis_id,c.id) if analysis_id else db.scalar(select(CareerGapAnalysis).where(CareerGapAnalysis.candidate_id==c.id).order_by(CareerGapAnalysis.created_at.desc()))
 if not a:return success({"sample_size":0,"skills":[],"message":"Run a career-gap analysis first."})
 total=max(1,a.sample_size);skills=sorted([{"skill":k,"job_count":v,"frequency_pct":round(100*v/total,1),"present":k in a.present_skills} for k,v in a.skill_frequency.items()],key=lambda x:x["job_count"],reverse=True);return success({"analysis_id":str(a.id),"target_role":a.target_role,"sample_size":a.sample_size,"skills":skills})

@router.get("/roadmaps")
def list_roadmaps(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);items=list(db.scalars(select(DevelopmentRoadmap).where(DevelopmentRoadmap.candidate_id==c.id).order_by(DevelopmentRoadmap.created_at.desc())));return success([roadmap_dict(x) for x in items])

@router.post("/roadmaps",status_code=201)
def create_roadmap(payload:RoadmapRequest,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
 c=candidate_for_user(db,user)
 if payload.analysis_id:
  try:aid=uuid.UUID(payload.analysis_id)
  except ValueError:raise HTTPException(status_code=422,detail="analysis_id must be a UUID")
  a=owned_or_404(db,CareerGapAnalysis,aid,c.id)
 else:a=db.scalar(select(CareerGapAnalysis).where(CareerGapAnalysis.candidate_id==c.id).order_by(CareerGapAnalysis.created_at.desc()))
 if not a:raise HTTPException(status_code=409,detail="Run a career-gap analysis first")
 return success(roadmap_dict(make_roadmap(db,user,a,payload.months)))
