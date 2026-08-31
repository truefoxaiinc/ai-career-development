from pydantic import BaseModel
class NotificationSettingsPayload(BaseModel):
    in_app_enabled:bool=True
    email_enabled:bool=True
    job_alerts_enabled:bool=True
    application_updates_enabled:bool=True
    marketing_enabled:bool=False
