from __future__ import annotations

import re
import uuid
from collections import Counter
from datetime import UTC, datetime
from typing import Iterable

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.ai.grounding import detect_prompt_injection, isolate_untrusted_text
from app.core.config import Settings
from app.domains.profiles.service import SKILLS
from app.integrations.jobs.providers import configured_providers
from app.models.entities import JobPosting, JobPreference, MatchResult, ProfileEntry, SavedJob, User
from app.repositories.common import candidate_for_user


def infer_requirements(description:str)->dict:
    skills=[]
    for skill in SKILLS:
        if re.search(rf"(?<!\w){re.escape(skill)}(?!\w)",description,re.I): skills.append(skill)
    years=[int(x) for x in re.findall(r"(\d{1,2})\+?\s*(?:years?|yrs?)",description,re.I)]
    return {"skills":skills,"experience_years":max(years) if years else None}


def ingest_provider_job(db:Session,pj)->JobPosting:
    existing=db.scalar(select(JobPosting).where(JobPosting.source==pj.source,JobPosting.external_id==pj.external_id))
    req=pj.requirements or infer_requirements(pj.description)
    payload={"title":pj.title[:300],"company":pj.company[:300],"location":pj.location[:300],"description":isolate_untrusted_text(pj.description),"apply_url":pj.apply_url,"requirements":req,"remote_mode":pj.remote_mode,"salary_min":pj.salary_min,"salary_max":pj.salary_max,"salary_currency":pj.salary_currency,"employment_type":pj.employment_type,"posted_at":pj.posted_at,"ingestion_meta":{**pj.raw_meta,"prompt_injection_flags":len(detect_prompt_injection(pj.description))},"is_active":True}
    if existing:
        for k,v in payload.items(): setattr(existing,k,v)
        return existing
    obj=JobPosting(source=pj.source,external_id=pj.external_id,**payload); db.add(obj); return obj


def refresh_from_configured_providers(db:Session,settings:Settings,query:str="engineer",location:str="",limit_per_provider:int=20)->dict:
    summary={"providers":{},"ingested":0}
    for provider in configured_providers(settings):
        if not provider.enabled():
            summary["providers"][getattr(provider,"name",provider.__class__.__name__)]={"enabled":False,"count":0}; continue
        name=getattr(provider,"name",provider.__class__.__name__)
        try:
            jobs=provider.search(query,location,limit_per_provider)
            for item in jobs: ingest_provider_job(db,item)
            db.commit(); summary["providers"][name]={"enabled":True,"count":len(jobs),"status":"ok"}; summary["ingested"]+=len(jobs)
        except Exception:
            db.rollback(); summary["providers"][name]={"enabled":True,"count":0,"status":"error"}
    return summary


def create_manual_job(db:Session,user:User,payload)->JobPosting:
    c=candidate_for_user(db,user); desc=isolate_untrusted_text(payload.description)
    job=JobPosting(source="candidate_input",external_id=str(uuid.uuid4()),title=payload.title.strip(),company=payload.company.strip(),location=payload.location.strip(),description=desc,requirements=infer_requirements(desc),apply_url=payload.apply_url.strip(),ingestion_meta={"candidate_id":str(c.id),"prompt_injection_flags":len(detect_prompt_injection(desc))})
    db.add(job); db.commit(); return job


def _job_dict(job:JobPosting)->dict:
    return {"id":str(job.id),"source":job.source,"title":job.title,"company":job.company,"location":job.location,"remote_mode":job.remote_mode,"description":job.description,"requirements":job.requirements,"salary_min":job.salary_min,"salary_max":job.salary_max,"salary_currency":job.salary_currency,"employment_type":job.employment_type,"apply_url":job.apply_url,"posted_at":job.posted_at.isoformat() if job.posted_at else None,"ingestion_meta":{"prompt_injection_flags":job.ingestion_meta.get("prompt_injection_flags",0)}}


def search_jobs(db:Session,user:User,q:str="",location:str="",source:str="",sort:str="recent",page:int=1,page_size:int=20)->dict:
    candidate=candidate_for_user(db,user); filters=[JobPosting.is_active.is_(True)]
    # candidate_input jobs are private to the candidate that created them.
    filters.append(or_(JobPosting.source!="candidate_input",func.json_extract(JobPosting.ingestion_meta,"$.candidate_id")==str(candidate.id))) if db.bind and db.bind.dialect.name=="sqlite" else filters.append(or_(JobPosting.source!="candidate_input",JobPosting.ingestion_meta["candidate_id"].as_string()==str(candidate.id)))
    if q:
        term=f"%{q.lower()}%"; filters.append(or_(func.lower(JobPosting.title).like(term),func.lower(JobPosting.company).like(term),func.lower(JobPosting.description).like(term)))
    if location: filters.append(func.lower(JobPosting.location).like(f"%{location.lower()}%"))
    if source: filters.append(JobPosting.source==source)
    stmt=select(JobPosting).where(*filters)
    if sort=="title": stmt=stmt.order_by(JobPosting.title.asc())
    else: stmt=stmt.order_by(JobPosting.posted_at.desc().nullslast(),JobPosting.created_at.desc())
    total=db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    jobs=list(db.scalars(stmt.offset((page-1)*page_size).limit(page_size)))
    saved_ids=set(db.scalars(select(SavedJob.job_id).where(SavedJob.candidate_id==candidate.id)))
    return {"items":[{**_job_dict(j),"saved":j.id in saved_ids} for j in jobs],"page":page,"page_size":page_size,"total":total,"pages":max(1,(total+page_size-1)//page_size)}


def get_job_for_user(db:Session,user:User,job_id:uuid.UUID)->JobPosting:
    job=db.get(JobPosting,job_id)
    if not job or not job.is_active: raise HTTPException(status_code=404,detail="Job not found")
    if job.source=="candidate_input" and job.ingestion_meta.get("candidate_id")!=str(candidate_for_user(db,user).id): raise HTTPException(status_code=404,detail="Job not found")
    return job


def _candidate_evidence(db:Session,user:User):
    c=candidate_for_user(db,user); entries=list(db.scalars(select(ProfileEntry).where(ProfileEntry.candidate_id==c.id,ProfileEntry.verified.is_(True)))); pref=db.scalar(select(JobPreference).where(JobPreference.candidate_id==c.id)); return c,entries,pref


def calculate_match(db:Session,user:User,job:JobPosting,settings:Settings)->MatchResult:
    c,entries,pref=_candidate_evidence(db,user); skills={e.label.lower():e for e in entries if e.entry_type=="skill"}; job_skills=job.requirements.get("skills") or infer_requirements(job.description).get("skills") or []
    strong=[];partial=[];missing=[]
    for req in job_skills:
        key=req.lower()
        if key in skills: strong.append({"label":req,"verified":True,"source_entry_id":str(skills[key].id)})
        elif any(key in s or s in key for s in skills if len(s)>3): partial.append({"label":req,"verified":True})
        else: missing.append({"label":req,"verified":False})
    skill_score=(len(strong)+0.5*len(partial))/max(1,len(job_skills)) if job_skills else 0.75
    exp_entries=[e for e in entries if e.entry_type=="experience"]
    required_years=job.requirements.get("experience_years")
    candidate_years=max([float(e.structured_data.get("years",0) or 0) for e in exp_entries]+[min(12,len(exp_entries)*1.5)])
    exp_score=min(1.0,candidate_years/max(1,float(required_years))) if required_years else (1.0 if exp_entries else 0.25)
    education_score=1.0 if any(e.entry_type=="education" for e in entries) or not re.search(r"bachelor|degree|master|phd",job.description,re.I) else 0.25
    candidate_words=set(re.findall(r"[a-z]{4,}",(c.headline+" "+c.profile_summary).lower())); role_words=set(re.findall(r"[a-z]{4,}",(job.title+" "+job.description[:3000]).lower())); domain_score=min(1.0,0.4+len(candidate_words&role_words)/8) if candidate_words else 0.4
    tool_terms={x for x in job_skills if any(k in x.lower() for k in ["sql","docker","aws","azure","gcp","git","react","python","java","graph","figma","terraform","kubernetes"])}; tools_score=(sum(1 for x in tool_terms if x.lower() in skills)/max(1,len(tool_terms))) if tool_terms else skill_score
    pref_score=0.5
    if pref:
        title_hit=not pref.target_titles or any(t.lower() in job.title.lower() or job.title.lower() in t.lower() for t in pref.target_titles)
        loc_hit=not pref.locations or any(l.lower() in job.location.lower() for l in pref.locations)
        pref_score=(float(title_hit)+float(loc_hit))/2
    certification_score=1.0 if any(e.entry_type=="certification" for e in entries) else 0.5
    factors={"skills":skill_score,"experience":exp_score,"education":education_score,"domain":domain_score,"tools":tools_score,"preferences":pref_score,"additional":certification_score}
    weights=settings.matching_weights; overall=round(100*sum(factors[k]*weights.get(k,0) for k in factors),1)
    breakdown={k:{"score":round(v*100,1),"weight":round(weights.get(k,0)*100,1)} for k,v in factors.items()}
    explanation=f"{len(strong)} strong, {len(partial)} partial and {len(missing)} missing skill requirements. Experience evidence contributes {round(exp_score*100)}%; preferences contribute {round(pref_score*100)}%."
    existing=db.scalar(select(MatchResult).where(MatchResult.candidate_id==c.id,MatchResult.job_id==job.id))
    if not existing: existing=MatchResult(candidate_id=c.id,job_id=job.id,score=overall,factor_breakdown=breakdown,strong_matches=strong,partial_matches=partial,missing_requirements=missing,explanation_text=explanation)
    else:
        existing.score=overall; existing.factor_breakdown=breakdown; existing.strong_matches=strong; existing.partial_matches=partial; existing.missing_requirements=missing; existing.explanation_text=explanation
    db.add(existing);db.commit();return existing


def match_dict(m:MatchResult,job:JobPosting)->dict:
    return {"id":str(m.id),"job_id":str(job.id),"company":job.company,"role":job.title,"location":job.location,"score":m.score,"factor_breakdown":m.factor_breakdown,"strong":m.strong_matches,"partial":m.partial_matches,"missing":m.missing_requirements,"explanation":m.explanation_text,"weight_version":m.weight_version}


def recommendations(db:Session,user:User,settings:Settings,limit:int=20)->list[dict]:
    c=candidate_for_user(db,user); jobs=list(db.scalars(select(JobPosting).where(JobPosting.is_active.is_(True)).order_by(JobPosting.posted_at.desc().nullslast(),JobPosting.created_at.desc()).limit(100)))
    out=[]
    for job in jobs:
        if job.source=="candidate_input" and job.ingestion_meta.get("candidate_id")!=str(c.id): continue
        m=calculate_match(db,user,job,settings); out.append({**_job_dict(job),"match":match_dict(m,job)})
    out.sort(key=lambda x:x["match"]["score"],reverse=True); return out[:limit]


def save_job(db:Session,user:User,job:JobPosting,note:str="")->SavedJob:
    c=candidate_for_user(db,user); saved=db.scalar(select(SavedJob).where(SavedJob.candidate_id==c.id,SavedJob.job_id==job.id))
    if saved: saved.note=note
    else: saved=SavedJob(candidate_id=c.id,job_id=job.id,note=note);db.add(saved)
    db.commit();return saved
