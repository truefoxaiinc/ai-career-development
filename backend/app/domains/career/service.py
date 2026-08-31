from __future__ import annotations

import uuid
from collections import Counter
from sqlalchemy import func,or_,select
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.domains.jobs.service import infer_requirements
from app.models.entities import CareerGapAnalysis,DevelopmentRoadmap,JobPosting,ProfileEntry,User
from app.repositories.common import candidate_for_user


def run_gap_analysis(db:Session,user:User,target_role:str,sample_size:int)->CareerGapAnalysis:
    c=candidate_for_user(db,user);words=[w for w in target_role.lower().split() if len(w)>2];stmt=select(JobPosting).where(JobPosting.is_active.is_(True))
    if words:stmt=stmt.where(or_(*[func.lower(JobPosting.title).like(f"%{w}%") for w in words]))
    jobs=list(db.scalars(stmt.order_by(JobPosting.posted_at.desc().nullslast(),JobPosting.created_at.desc()).limit(sample_size)))
    counts=Counter()
    for j in jobs:
        for s in (j.requirements.get("skills") or infer_requirements(j.description).get("skills") or []):counts[str(s)]+=1
    verified={e.label.lower():e.label for e in db.scalars(select(ProfileEntry).where(ProfileEntry.candidate_id==c.id,ProfileEntry.verified.is_(True),ProfileEntry.entry_type=="skill"))}
    present=[];missing=[]
    for skill,count in counts.most_common():
        freq=round(100*count/max(1,len(jobs)),1)
        if skill.lower() in verified:present.append(skill)
        else:missing.append({"skill":skill,"job_count":count,"frequency_pct":freq,"priority":"high" if freq>=50 else "medium" if freq>=25 else "lower"})
    recommendations=[{"skill":m["skill"],"priority":m["priority"],"why":f"Requested in {m['frequency_pct']}% of the {len(jobs)} sampled matching jobs.","next_step":f"Build one small, evidence-producing project or work sample using {m['skill']}, then add it to the profile only after you can verify the experience."} for m in missing[:12]]
    a=CareerGapAnalysis(candidate_id=c.id,target_role=target_role,sample_size=len(jobs),skill_frequency=dict(counts),present_skills=present,missing_skills=missing,recommendations=recommendations);db.add(a);db.commit();return a


def analysis_dict(a:CareerGapAnalysis)->dict:return {"id":str(a.id),"target_role":a.target_role,"sample_size":a.sample_size,"skill_frequency":a.skill_frequency,"present_skills":a.present_skills,"missing_skills":a.missing_skills,"recommendations":a.recommendations,"created_at":a.created_at.isoformat()}


def make_roadmap(db:Session,user:User,analysis:CareerGapAnalysis,months:int)->DevelopmentRoadmap:
    c=candidate_for_user(db,user);missing=analysis.missing_skills[:max(months*2,months)];plan=[]
    for month in range(1,months+1):
        assigned=missing[(month-1)*2:month*2] or missing[(month-1):month]
        plan.append({"month":month,"focus":[x["skill"] for x in assigned],"objectives":[f"Learn the fundamentals of {x['skill']} and create evidence through a practical exercise." for x in assigned],"evidence_gate":"Do not mark a skill verified until you can point to a project, employment task, certification, or other source fact that supports it."})
    r=DevelopmentRoadmap(candidate_id=c.id,analysis_id=analysis.id,target_role=analysis.target_role,months=plan,status="active");db.add(r);db.commit();return r


def roadmap_dict(r:DevelopmentRoadmap)->dict:return {"id":str(r.id),"analysis_id":str(r.analysis_id) if r.analysis_id else None,"target_role":r.target_role,"months":r.months,"status":r.status,"created_at":r.created_at.isoformat()}
