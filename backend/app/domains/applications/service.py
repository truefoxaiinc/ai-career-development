from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Application, AuditLog, GeneratedDocument, JobPosting, ProfileEntry, User
from app.repositories.common import candidate_for_user

STATUSES=["Recommended","Saved","Resume generated","Applied","Screening","Interview","Technical interview","Offer","Rejected","Withdrawn"]


def _doc_owned(db:Session,candidate_id:uuid.UUID,doc_id:uuid.UUID|None,job_id:uuid.UUID,kind:str)->GeneratedDocument|None:
    if not doc_id:return None
    doc=db.get(GeneratedDocument,doc_id)
    if not doc or doc.candidate_id!=candidate_id or doc.document_type!=kind or doc.job_id!=job_id: raise HTTPException(status_code=400,detail=f"Invalid {kind} document")
    return doc


def create_or_update_application(db:Session,user:User,payload)->Application:
    c=candidate_for_user(db,user);job=db.get(JobPosting,payload.job_id)
    if not job:raise HTTPException(status_code=404,detail="Job not found")
    resume=_doc_owned(db,c.id,payload.resume_document_id,job.id,"resume");cover=_doc_owned(db,c.id,payload.cover_letter_document_id,job.id,"cover_letter")
    app=db.scalar(select(Application).where(Application.candidate_id==c.id,Application.job_id==job.id))
    if not app:
        app=Application(candidate_id=c.id,job_id=job.id,status="Resume generated" if resume else "Saved",notes=payload.notes);db.add(app)
    if resume:app.resume_document_id=resume.id
    if cover:app.cover_letter_document_id=cover.id
    app.notes=payload.notes
    db.commit();return app


def application_dict(db:Session,app:Application)->dict:
    job=db.get(JobPosting,app.job_id);resume=db.get(GeneratedDocument,app.resume_document_id) if app.resume_document_id else None;cover=db.get(GeneratedDocument,app.cover_letter_document_id) if app.cover_letter_document_id else None
    return {"id":str(app.id),"job_id":str(app.job_id),"status":app.status,"notes":app.notes,"outcome":app.outcome,"approved_at":app.approved_at.isoformat() if app.approved_at else None,"applied_at":app.applied_at.isoformat() if app.applied_at else None,"updated_at":app.updated_at.isoformat(),"job":{"title":job.title,"company":job.company,"location":job.location,"apply_url":job.apply_url} if job else None,"resume":{"id":str(resume.id),"version":resume.version,"approved":bool(resume.approved_at),"claim_status":resume.claim_report.get("status")} if resume else None,"cover_letter":{"id":str(cover.id),"version":cover.version,"approved":bool(cover.approved_at),"claim_status":cover.claim_report.get("status")} if cover else None}


def approve_application(db:Session,user:User,app:Application,approved:bool)->Application:
    if not approved:
        app.approved_at=None;db.commit();return app
    docs=[]
    if app.resume_document_id:docs.append(db.get(GeneratedDocument,app.resume_document_id))
    if app.cover_letter_document_id:docs.append(db.get(GeneratedDocument,app.cover_letter_document_id))
    if not docs:raise HTTPException(status_code=409,detail="Attach at least one document before application approval")
    for doc in docs:
        if not doc or not doc.approved_at or doc.claim_report.get("unsupported_claims",0): raise HTTPException(status_code=409,detail="Every attached document must be claim-verified and approved")
    app.approved_at=datetime.now(UTC);db.add(AuditLog(user_id=user.id,action="application.approved",resource_type="application",resource_id=str(app.id),metadata_json={"resume_document_id":str(app.resume_document_id) if app.resume_document_id else None,"cover_letter_document_id":str(app.cover_letter_document_id) if app.cover_letter_document_id else None}));db.commit();return app


def mark_applied(db:Session,user:User,app:Application,confirmed:bool)->Application:
    if not confirmed:raise HTTPException(status_code=400,detail="Explicit candidate confirmation is required")
    if not app.approved_at:raise HTTPException(status_code=409,detail="Application package must be approved first")
    app.status="Applied";app.applied_at=datetime.now(UTC);db.add(AuditLog(user_id=user.id,action="application.marked_applied",resource_type="application",resource_id=str(app.id),metadata_json={"submission_mode":"manual_candidate_confirmation"}));db.commit();return app


def draft_answers(db:Session,user:User,questions:list[str])->list[dict]:
    c=candidate_for_user(db,user);entries=list(db.scalars(select(ProfileEntry).where(ProfileEntry.candidate_id==c.id,ProfileEntry.verified.is_(True))))
    sources=[(e,_tokens(e.label+" "+(e.source_text or "")+" "+str(e.structured_data))) for e in entries]
    answers=[]
    for q in questions:
        qt=_tokens(q);ranked=sorted(sources,key=lambda x:len(qt&x[1]),reverse=True);chosen=[x[0] for x in ranked if len(qt&x[1])>0][:2]
        if not chosen:
            answers.append({"question":q,"answer":"CareerPilot could not ground an answer in verified profile facts. Add or verify relevant experience before using AI-assisted answers.","source_entry_ids":[],"status":"needs_input"})
        else:
            facts=[(e.source_text or e.structured_data.get("raw") or e.label) for e in chosen]
            answers.append({"question":q,"answer":"Based on my verified profile: "+" ".join(str(f) for f in facts),"source_entry_ids":[str(e.id) for e in chosen],"status":"grounded_draft"})
    return answers


def _tokens(text:str)->set[str]:return {x for x in re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}",text.lower()) if x not in {"the","and","for","with","your","you","our","are","was","what","how","why","tell","about"}}
