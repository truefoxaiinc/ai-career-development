from sqlalchemy import inspect
from app.core.database import engine
from app.core.database import Base
import app.models.entities  # noqa

def test_model_metadata_contains_required_tables():
    required={"users","candidates","profile_entries","job_preferences","job_postings","match_results","saved_jobs","generated_documents","applications","interview_sessions","star_answers","career_gap_analyses","development_roadmaps","notifications","consent_records","audit_logs","admin_roles"}
    assert required.issubset(set(Base.metadata.tables))
