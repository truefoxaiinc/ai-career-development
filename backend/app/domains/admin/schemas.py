from pydantic import BaseModel
class UserAdminUpdate(BaseModel):
    is_active:bool|None=None
    role:str|None=None

class ProviderRefreshRequest(BaseModel):
    query:str="engineer"
    location:str=""
    limit_per_provider:int=20
