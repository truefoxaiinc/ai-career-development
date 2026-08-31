from __future__ import annotations

import uuid
from pydantic import BaseModel,Field

class SessionCreate(BaseModel):
    job_id:uuid.UUID|None=None
    question_count:int=Field(default=6,ge=3,le=20)

class AnswerRequest(BaseModel):
    question_id:str=Field(min_length=1,max_length=100)
    answer:str=Field(min_length=1,max_length=20_000)

class STARPayload(BaseModel):
    theme:str=Field(min_length=1,max_length=150)
    title:str=Field(min_length=1,max_length=250)
    situation:str=Field(default="",max_length=10_000)
    task:str=Field(default="",max_length=10_000)
    action:str=Field(default="",max_length=10_000)
    result:str=Field(default="",max_length=10_000)
    tags:list[str]=Field(default_factory=list,max_length=20)
