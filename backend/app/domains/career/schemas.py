from pydantic import BaseModel,Field

class GapAnalysisRequest(BaseModel):
    target_role:str=Field(min_length=2,max_length=250)
    sample_size:int=Field(default=50,ge=5,le=100)

class RoadmapRequest(BaseModel):
    analysis_id:str|None=None
    months:int=Field(default=6,ge=1,le=12)
