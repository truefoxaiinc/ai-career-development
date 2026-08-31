from __future__ import annotations

import re
import uuid
from datetime import UTC,datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.entities import InterviewSession,JobPosting,ProfileEntry,STARAnswer,User
from app.repositories.common import candidate_for_user


def generate_questions(db:Session,user:User,job:JobPosting|None=None,count:int=10)->list[dict]:
    c=candidate_for_user(db,user);entries=list(db.scalars(select(ProfileEntry).where(ProfileEntry.candidate_id==c.id,ProfileEntry.verified.is_(True))))
    exp=[e for e in entries if e.entry_type in {"experience","achievement","project"}];skills=[e.label for e in entries if e.entry_type=="skill"]
    qs=[
        ("general","Tell me about the work you want to do next and why."),
        ("general","What kind of team environment helps you do your best work?"),
        ("behavioral","Tell me about a difficult problem you solved. Structure your answer using Situation, Task, Action and Result."),
        ("behavioral","Describe a disagreement where you influenced the outcome without relying on authority."),
        ("behavioral","Tell me about a time you changed course after receiving difficult feedback."),
    ]
    for e in exp[:3]: qs.append(("resume_based",f"Walk me through this verified profile item and your contribution: {e.label}"))
    if job:
        req=job.requirements.get("skills") or []
        for skill in req[:4]:qs.append(("technical",f"How have you used {skill}, and how would you apply it to the {job.title} role?"))
        qs.append(("company_specific",f"Why are you interested in the {job.title} opportunity at {job.company}?"))
        qs.append(("job_specific",f"Which requirements in this {job.title} role are your strongest match, and which would require ramp-up?"))
    elif skills:
        for s in skills[:3]:qs.append(("technical",f"Explain a challenging production decision you made involving {s}."))
    out=[]
    for idx,(cat,text) in enumerate(qs[:count],1):out.append({"id":f"q{idx}","category":cat,"question":text})
    return out


def create_session(db:Session,user:User,job_id:uuid.UUID|None,count:int)->InterviewSession:
    c=candidate_for_user(db,user);job=None
    if job_id:
        job=db.get(JobPosting,job_id)
        if not job:raise HTTPException(status_code=404,detail="Job not found")
    s=InterviewSession(candidate_id=c.id,job_id=job_id,session_type="text",questions=generate_questions(db,user,job,count));db.add(s);db.commit();return s


def session_dict(s:InterviewSession)->dict:return {"id":str(s.id),"job_id":str(s.job_id) if s.job_id else None,"session_type":s.session_type,"status":s.status,"questions":s.questions,"transcript":s.transcript,"scores":s.scores,"feedback":s.feedback,"completed_at":s.completed_at.isoformat() if s.completed_at else None,"created_at":s.created_at.isoformat()}


def add_answer(db:Session,s:InterviewSession,question_id:str,answer:str)->InterviewSession:
    if s.status!="in_progress":raise HTTPException(status_code=409,detail="Interview session is already complete")
    question=next((q for q in s.questions if q["id"]==question_id),None)
    if not question:raise HTTPException(status_code=404,detail="Question not found")
    transcript=[x for x in s.transcript if x.get("question_id")!=question_id];transcript.append({"question_id":question_id,"question":question["question"],"category":question["category"],"answer":answer.strip()});s.transcript=transcript;db.commit();return s


def _score_answer(item:dict,job:JobPosting|None)->dict:
    answer=item.get("answer","");words=re.findall(r"\b\w+\b",answer);length=len(words);clarity=min(100,max(20,40+min(length,120)//2))
    qtokens={x for x in re.findall(r"[a-z]{3,}",item.get("question","").lower()) if x not in {"tell","about","your","have","would","this","that","which","role"}};atokens=set(re.findall(r"[a-z]{3,}",answer.lower()));relevance=min(100,45+8*len(qtokens&atokens))
    if job:
        for skill in job.requirements.get("skills") or []:
            if skill.lower() in answer.lower():relevance=min(100,relevance+6)
    star_terms=sum(1 for term in ["situation","task","action","result"] if term in answer.lower());structure=35+star_terms*15 if item.get("category")=="behavioral" else min(95,45+length//2);structure=min(100,structure)
    completeness=min(100,30+length)
    overall=round((clarity+relevance+structure+completeness)/4)
    notes=[]
    if length<45:notes.append("Add specific context, decisions and outcomes; the answer is currently brief.")
    if item.get("category")=="behavioral" and star_terms<2:notes.append("Make the Situation, Task, Action and Result structure explicit.")
    if not re.search(r"\d",answer):notes.append("Where truthful and verified, quantify scope or outcome to make the answer more concrete.")
    if not notes:notes.append("The answer is specific and structured; tighten wording while preserving the evidence.")
    return {"question_id":item.get("question_id"),"overall":overall,"relevance":relevance,"clarity":clarity,"structure":structure,"completeness":completeness,"feedback":notes}


def complete_session(db:Session,s:InterviewSession)->InterviewSession:
    if not s.transcript:raise HTTPException(status_code=409,detail="Answer at least one question before completing the session")
    job=db.get(JobPosting,s.job_id) if s.job_id else None;per=[_score_answer(x,job) for x in s.transcript];avg=lambda k:round(sum(x[k] for x in per)/len(per))
    s.scores={"overall":avg("overall"),"relevance":avg("relevance"),"clarity":avg("clarity"),"structure":avg("structure"),"completeness":avg("completeness"),"questions":per};weak=min(["relevance","clarity","structure","completeness"],key=lambda k:s.scores[k]);s.feedback=f"Strongest answers preserve specific evidence. Your lowest aggregate dimension is {weak}; use the question-level feedback to improve it on the next attempt.";s.status="completed";s.completed_at=datetime.now(UTC);db.commit();return s
