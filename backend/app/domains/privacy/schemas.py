from __future__ import annotations
from pydantic import BaseModel,Field

class ConsentPayload(BaseModel):
    purpose:str=Field(min_length=1,max_length=100)
    policy_version:str=Field(min_length=1,max_length=64)
    granted:bool

class DeleteAccountRequest(BaseModel):
    confirmation:str
    password:str|None=Field(default=None,max_length=128)
