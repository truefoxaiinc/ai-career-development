from __future__ import annotations

import pytest

from app.core.database import engine
from app.models.entities import AsyncJob
from app.worker import verify_database_ready


def test_worker_database_preflight_accepts_migrated_database():
    verify_database_ready()


def test_worker_database_preflight_rejects_missing_async_jobs_table():
    AsyncJob.__table__.drop(bind=engine)

    with pytest.raises(RuntimeError, match=r"Required table async_jobs is not available"):
        verify_database_ready()
