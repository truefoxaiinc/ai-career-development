from __future__ import annotations
import uuid
from decimal import Decimal
from typing import Annotated
from fastapi import APIRouter,Depends,Query
from sqlalchemy import func,select
from sqlalchemy.orm import Session
from app.core.config import Settings,get_settings
from app.core.database import get_db
from app.core.security import require_admin
from app.domains.jobs.service import refresh_from_configured_providers
from app.integrations.jobs.providers import configured_providers
from app.models.entities import AIUsageLog,Application,AsyncJob,AuditLog,GeneratedDocument,JobPosting,User
from app.schemas.common import success
from .schemas import ProviderRefreshRequest,UserAdminUpdate

router=APIRouter(prefix="/admin",tags=["admin"])

@router.get("/dashboard")
def dashboard(admin:Annotated[User,Depends(require_admin)],db:Annotated[Session,Depends(get_db)]):
    counts={"users":db.scalar(select(func.count()).select_from(User)) or 0,"active_users":db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True))) or 0,"jobs":db.scalar(select(func.count()).select_from(JobPosting).where(JobPosting.is_active.is_(True))) or 0,"applications":db.scalar(select(func.count()).select_from(Application)) or 0,"documents":db.scalar(select(func.count()).select_from(GeneratedDocument)) or 0,"queued_tasks":db.scalar(select(func.count()).select_from(AsyncJob).where(AsyncJob.status=="queued")) or 0,"failed_tasks":db.scalar(select(func.count()).select_from(AsyncJob).where(AsyncJob.status=="failed")) or 0}
    recent=list(db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(20)));return success({"counts":counts,"recent_audit":[{"action":x.action,"resource_type":x.resource_type,"created_at":x.created_at.isoformat(),"metadata":x.metadata_json} for x in recent]})

@router.get("/users")
def users(admin:Annotated[User,Depends(require_admin)],db:Annotated[Session,Depends(get_db)],q:str="",page:int=Query(1,ge=1),page_size:int=Query(50,ge=1,le=100)):
    stmt=select(User)
    if q:stmt=stmt.where(func.lower(User.email).like(f"%{q.lower()}%"))
    total=db.scalar(select(func.count()).select_from(stmt.subquery())) or 0;items=list(db.scalars(stmt.order_by(User.created_at.desc()).offset((page-1)*page_size).limit(page_size)));return success({"items":[{"id":str(u.id),"email":u.email,"role":u.role,"is_active":u.is_active,"is_email_verified":u.is_email_verified,"created_at":u.created_at.isoformat(),"last_login_at":u.last_login_at.isoformat() if u.last_login_at else None} for u in items],"total":total,"page":page,"page_size":page_size})

@router.patch("/users/{user_id}")
def update_user(user_id:uuid.UUID,payload:UserAdminUpdate,admin:Annotated[User,Depends(require_admin)],db:Annotated[Session,Depends(get_db)]):
    target=db.get(User,user_id)
    if not target:return success({"updated":False})
    if payload.is_active is not None:target.is_active=payload.is_active
    if payload.role in {"candidate","admin"}:target.role=payload.role
    db.add(AuditLog(user_id=admin.id,action="admin.user_updated",resource_type="user",resource_id=str(target.id),metadata_json={"fields":list(payload.model_dump(exclude_unset=True))}));db.commit();return success({"updated":True})

@router.get("/system")
def system(admin:Annotated[User,Depends(require_admin)],db:Annotated[Session,Depends(get_db)],settings:Annotated[Settings,Depends(get_settings)]):
    provider_status=[]
    for p in configured_providers(settings):provider_status.append({"name":getattr(p,"name",p.__class__.__name__),"enabled":p.enabled()})
    by_source=db.execute(select(JobPosting.source,func.count(JobPosting.id)).group_by(JobPosting.source)).all();usage=db.execute(select(AIUsageLog.feature,func.count(AIUsageLog.id),func.avg(AIUsageLog.latency_ms),func.sum(AIUsageLog.estimated_cost_usd)).group_by(AIUsageLog.feature)).all()
    return success({"environment":settings.environment,"task_mode":settings.task_mode,"storage_backend":settings.storage_backend,"auth_mode":settings.auth_mode,"providers":provider_status,"jobs_by_source":[{"source":x[0],"count":x[1]} for x in by_source],"ai_usage":[{"feature":x[0],"calls":x[1],"avg_latency_ms":round(float(x[2] or 0),1),"estimated_cost_usd":float(x[3] or 0)} for x in usage],"llm_configured":bool(settings.litellm_base_url and settings.litellm_api_key and settings.litellm_model)})

@router.post("/system/refresh-jobs")
def refresh(payload:ProviderRefreshRequest,admin:Annotated[User,Depends(require_admin)],db:Annotated[Session,Depends(get_db)],settings:Annotated[Settings,Depends(get_settings)]):return success(refresh_from_configured_providers(db,settings,payload.query,payload.location,min(max(payload.limit_per_provider,1),50)))
