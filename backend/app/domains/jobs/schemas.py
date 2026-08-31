from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl


class ManualJobRequest(BaseModel):
    title: str = Field(min_length=1,max_length=300)
    company: str = Field(min_length=1,max_length=300)
    location: str = Field(default="",max_length=300)
    description: str = Field(min_length=30,max_length=100_000)
    apply_url: str = Field(default="",max_length=4000)


class SaveJobRequest(BaseModel):
    note: str = Field(default="",max_length=4000)
