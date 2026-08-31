from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_verified_user
from app.models.entities import Application,User
from app.repositories.common import candidate_for_user,owned_or_404
from app.schemas.common import success
from .schemas import ApplicationApproval,ApplicationCreate,ApplicationUpdate,DraftAnswersRequest,MarkAppliedRequest
from .service import application_dict,approve_application,create_or_update_application,draft_answers,mark_applied

router=APIRouter(prefix="/applications",tags=["applications"])

@router.get("")
def list_apps(user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user);apps=list(db.scalars(select(Application).where(Application.candidate_id==c.id).order_by(Application.updated_at.desc())));return success([application_dict(db,a) for a in apps])

@router.post("",status_code=201)
def create(payload:ApplicationCreate,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):return success(application_dict(db,create_or_update_application(db,user,payload)))

@router.get("/{application_id}")
def detail(application_id:uuid.UUID,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);return success(application_dict(db,owned_or_404(db,Application,application_id,c.id)))

@router.patch("/{application_id}")
def patch(application_id:uuid.UUID,payload:ApplicationUpdate,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):
    c=candidate_for_user(db,user);app=owned_or_404(db,Application,application_id,c.id)
    for k,v in payload.model_dump(exclude_unset=True).items():setattr(app,k,v)
    # Status Applied is reserved for the explicit mark-applied endpoint.
    if payload.status=="Applied":raise HTTPException(status_code=409,detail="Use mark-applied with explicit confirmation")
    db.commit();return success(application_dict(db,app))

@router.post("/{application_id}/approve")
def approve(application_id:uuid.UUID,payload:ApplicationApproval,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);app=owned_or_404(db,Application,application_id,c.id);return success(application_dict(db,approve_application(db,user,app,payload.approved)))

@router.post("/{application_id}/mark-applied")
def applied(application_id:uuid.UUID,payload:MarkAppliedRequest,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);app=owned_or_404(db,Application,application_id,c.id);return success(application_dict(db,mark_applied(db,user,app,payload.confirmed)))

@router.post("/{application_id}/draft-answers")
def answers(application_id:uuid.UUID,payload:DraftAnswersRequest,user:Annotated[User,Depends(require_verified_user)],db:Annotated[Session,Depends(get_db)]):c=candidate_for_user(db,user);owned_or_404(db,Application,application_id,c.id);return success(draft_answers(db,user,payload.questions))
