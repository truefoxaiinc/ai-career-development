from __future__ import annotations

import hashlib
import io
import json
import re
import uuid
import zipfile
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

from docx import Document
from fastapi import HTTPException, UploadFile
from pypdf import PdfReader
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.ai.grounding import detect_prompt_injection, isolate_untrusted_text
from app.core.config import Settings
from app.integrations.storage import get_storage
from app.models.entities import AsyncJob, AuditLog, Candidate, JobPreference, ProfileEntry, UploadedFile, User
from app.repositories.common import candidate_for_user

SKILLS = [
    "Python","Java","JavaScript","TypeScript","React","Next.js","Node.js","FastAPI","Django","Flask","SQL","PostgreSQL","MySQL","Redis","Valkey","Docker","Kubernetes","AWS","Azure","GCP","Terraform","GraphQL","REST","Accessibility","Design systems","System design","Machine learning","Data analysis","Pandas","PyTorch","TensorFlow","Git","CI/CD","Testing","Playwright","Cypress","Leadership","Mentoring","Product management","Figma"
]


def calculate_completion(candidate: Candidate, entries: list[ProfileEntry]) -> int:
    score = 0
    score += 10 if candidate.name else 0
    score += 10 if candidate.headline else 0
    score += 10 if candidate.location else 0
    verified=[e for e in entries if e.verified]
    types={e.entry_type for e in verified}
    score += 25 if "experience" in types else 0
    score += 15 if "education" in types else 0
    score += 20 if "skill" in types else 0
    score += 10 if any(t in types for t in {"achievement","project","certification"}) else 0
    return min(100,score)


def profile_view(db: Session, user: User) -> dict:
    candidate=candidate_for_user(db,user)
    entries=list(db.scalars(select(ProfileEntry).where(ProfileEntry.candidate_id==candidate.id).order_by(ProfileEntry.entry_type,ProfileEntry.created_at)))
    completion=calculate_completion(candidate,entries)
    if candidate.profile_completion!=completion:
        candidate.profile_completion=completion; db.commit()
    return {
        "id":str(candidate.id),"name":candidate.name,"headline":candidate.headline,"location":candidate.location,"phone":candidate.phone,"links":candidate.links,"profile_summary":candidate.profile_summary,"profile_completion":completion,
        "entries":[{"id":str(e.id),"entry_type":e.entry_type,"label":e.label,"structured_data":e.structured_data,"source_text":e.source_text,"verified":e.verified,"confidence":e.confidence,"source_file_id":str(e.source_file_id) if e.source_file_id else None,"verification_note":e.verification_note} for e in entries]
    }


def update_candidate(db:Session,user:User,fields:dict)->Candidate:
    candidate=candidate_for_user(db,user)
    for key,value in fields.items():
        if value is not None and hasattr(candidate,key): setattr(candidate,key,value.strip() if isinstance(value,str) else value)
    db.add(AuditLog(user_id=user.id,action="profile.updated",resource_type="candidate",resource_id=str(candidate.id),metadata_json={"fields":sorted(k for k,v in fields.items() if v is not None)}))
    db.commit(); return candidate


def add_manual_entry(db:Session,user:User,payload)->ProfileEntry:
    candidate=candidate_for_user(db,user)
    entry=ProfileEntry(candidate_id=candidate.id,entry_type=payload.entry_type,label=payload.label.strip(),structured_data=payload.structured_data,source_text=payload.source_text,verified=True,confidence=1.0,verification_note="Entered directly by candidate",verified_at=datetime.now(UTC))
    db.add(entry); db.add(AuditLog(user_id=user.id,action="profile.entry_created",resource_type="profile_entry",resource_id=str(entry.id),metadata_json={"type":payload.entry_type})); db.commit(); return entry


def validate_resume_upload(file: UploadFile, data: bytes, settings: Settings) -> tuple[str,str]:
    if len(data)>settings.upload_max_bytes: raise HTTPException(status_code=413,detail=f"Resume exceeds {settings.upload_max_bytes//(1024*1024)} MB limit")
    name=(file.filename or "resume").lower(); ext=Path(name).suffix
    allowed={".pdf":"application/pdf",".docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    if ext not in allowed: raise HTTPException(status_code=415,detail="Only PDF and DOCX resumes are supported")
    content_type=(file.content_type or "").lower()
    if content_type not in {allowed[ext],"application/octet-stream"}:
        raise HTTPException(status_code=415,detail="Resume MIME type does not match an allowed document type")
    if ext==".pdf" and not data.startswith(b"%PDF-"): raise HTTPException(status_code=415,detail="File content is not a valid PDF")
    if ext==".docx":
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                if "word/document.xml" not in zf.namelist(): raise ValueError
        except (zipfile.BadZipFile,ValueError) as exc: raise HTTPException(status_code=415,detail="File content is not a valid DOCX") from exc
    return ext,allowed[ext]


def store_resume(db:Session,user:User,file:UploadFile,data:bytes,settings:Settings)->UploadedFile:
    candidate=candidate_for_user(db,user); ext,mime=validate_resume_upload(file,data,settings); digest=hashlib.sha256(data).hexdigest(); storage=get_storage(settings)
    key=f"resumes/{candidate.id}/{uuid.uuid4()}{ext}"; storage.put_bytes(key,data,mime)
    record=UploadedFile(candidate_id=candidate.id,kind="resume",original_name=Path(file.filename or f"resume{ext}").name[:255],mime_type=mime,size_bytes=len(data),sha256=digest,storage_key=key)
    db.add(record); db.flush(); return record


def _extract_text(data:bytes,mime:str)->str:
    if mime=="application/pdf":
        reader=PdfReader(io.BytesIO(data)); text="\n".join((page.extract_text() or "") for page in reader.pages)
    else:
        doc=Document(io.BytesIO(data)); text="\n".join(p.text for p in doc.paragraphs)
        for table in doc.tables:
            for row in table.rows: text += "\n"+" | ".join(cell.text for cell in row.cells)
    return isolate_untrusted_text(text)


def _extract_entries(text:str)->list[dict]:
    lines=[re.sub(r"\s+"," ",x).strip() for x in text.splitlines() if x.strip()]
    entries=[]
    if lines:
        first=lines[0]
        if 2<=len(first)<=80 and not re.search(r"@|\d{7,}",first): entries.append({"entry_type":"personal","label":"Name","structured_data":{"name":first},"source_text":first,"confidence":0.72})
    for skill in SKILLS:
        if re.search(rf"(?<!\w){re.escape(skill)}(?!\w)",text,re.I): entries.append({"entry_type":"skill","label":skill,"structured_data":{"name":skill},"source_text":skill,"confidence":0.91})
    education=[]; experience=[]; certs=[]; projects=[]
    for line in lines:
        low=line.lower()
        if any(k in low for k in ["b.tech","bachelor","master","m.tech","university","college","institute of technology","ph.d","phd"]): education.append(line)
        if any(k in low for k in ["engineer","developer","manager","architect","designer","analyst","consultant","scientist","lead ","director","specialist"]): experience.append(line)
        if any(k in low for k in ["certified","certification","certificate"]): certs.append(line)
        if any(k in low for k in ["project:","projects","built ","developed ","implemented "]): projects.append(line)
    for line in education[:8]: entries.append({"entry_type":"education","label":line[:240],"structured_data":{"raw":line},"source_text":line,"confidence":0.70})
    for line in experience[:14]: entries.append({"entry_type":"experience","label":line[:240],"structured_data":{"raw":line},"source_text":line,"confidence":0.62})
    for line in certs[:8]: entries.append({"entry_type":"certification","label":line[:240],"structured_data":{"raw":line},"source_text":line,"confidence":0.68})
    for line in projects[:8]: entries.append({"entry_type":"project","label":line[:240],"structured_data":{"raw":line},"source_text":line,"confidence":0.58})
    # Deduplicate same type + normalized label.
    seen=set(); out=[]
    for e in entries:
        key=(e["entry_type"],e["label"].lower())
        if key not in seen: seen.add(key); out.append(e)
    return out


def process_resume_parse_task(db:Session,task:AsyncJob)->None:
    from app.domains.tasks.service import update_task
    file_id=uuid.UUID(task.payload["file_id"]); record=db.get(UploadedFile,file_id)
    if not record: update_task(db,task,status="failed",progress=100,error_code="file_missing"); return
    update_task(db,task,progress=20); data=get_storage().get_bytes(record.storage_key); update_task(db,task,progress=35)
    text=_extract_text(data,record.mime_type)
    if len(text.strip())<20: update_task(db,task,status="failed",progress=100,error_code="resume_text_unreadable"); return
    flags=detect_prompt_injection(text); update_task(db,task,progress=55)
    db.execute(delete(ProfileEntry).where(ProfileEntry.source_file_id==record.id,ProfileEntry.verified.is_(False)))
    extracted=_extract_entries(text)
    for item in extracted:
        db.add(ProfileEntry(candidate_id=record.candidate_id,source_file_id=record.id,verified=False,verification_note="Extracted from resume; candidate confirmation required",**item))
    db.commit(); update_task(db,task,status="succeeded",progress=100,result={"file_id":str(record.id),"extracted_count":len(extracted),"review_required":True,"prompt_injection_flags":len(flags)})


def verify_entries(db:Session,user:User,decisions)->dict:
    candidate=candidate_for_user(db,user); accepted=edited=rejected=0
    for d in decisions:
        entry=db.get(ProfileEntry,d.entry_id)
        if not entry or entry.candidate_id!=candidate.id: raise HTTPException(status_code=404,detail="Profile entry not found")
        if d.action=="reject": db.delete(entry); rejected+=1; continue
        if d.action=="edit":
            if d.label: entry.label=d.label.strip()
            if d.structured_data is not None: entry.structured_data=d.structured_data
            edited+=1
        else: accepted+=1
        entry.verified=True; entry.verified_at=datetime.now(UTC); entry.confidence=1.0; entry.verification_note="Verified by candidate"
        if entry.entry_type=="personal" and "name" in entry.structured_data and not candidate.name: candidate.name=str(entry.structured_data["name"])[:200]
    entries=list(db.scalars(select(ProfileEntry).where(ProfileEntry.candidate_id==candidate.id))); candidate.profile_completion=calculate_completion(candidate,entries)
    db.add(AuditLog(user_id=user.id,action="profile.extraction_verified",resource_type="candidate",resource_id=str(candidate.id),metadata_json={"accepted":accepted,"edited":edited,"rejected":rejected})); db.commit()
    return {"accepted":accepted,"edited":edited,"rejected":rejected,"profile_completion":candidate.profile_completion}


def profile_analysis(db:Session,user:User)->dict:
    candidate=candidate_for_user(db,user); entries=list(db.scalars(select(ProfileEntry).where(ProfileEntry.candidate_id==candidate.id,ProfileEntry.verified.is_(True))))
    skills={e.label.lower() for e in entries if e.entry_type=="skill"}
    categories=[
        ("Frontend Engineering",{"react","typescript","javascript","next.js","accessibility","design systems"}),
        ("Backend Engineering",{"python","java","fastapi","django","node.js","postgresql","redis","valkey","rest"}),
        ("Platform / DevOps",{"docker","kubernetes","terraform","aws","azure","gcp","ci/cd"}),
        ("Data / ML",{"python","machine learning","data analysis","pandas","pytorch","tensorflow","sql"}),
        ("Product Engineering",{"react","typescript","node.js","postgresql","product management","figma"}),
    ]
    scored=[]
    for name,expected in categories:
        hit=len(skills & expected); fit=round(100*hit/max(1,min(len(expected),5)))
        if hit: scored.append({"category":name,"fit":min(96,40+fit//2),"reason":f"Supported by {hit} verified skill{'s' if hit!=1 else ''}: "+", ".join(sorted({x for x in skills if x in expected})[:5])})
    if not scored: scored=[{"category":"General professional","fit":50,"reason":"Add verified skills and experience to improve analysis confidence."}]
    scored.sort(key=lambda x:x["fit"],reverse=True)
    return {"primary":scored[0],"adjacent":scored[1:4],"verified_entry_count":len(entries),"method":"verified-profile heuristic v1"}
