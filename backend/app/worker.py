from __future__ import annotations

import logging
import signal
import time

from sqlalchemy import inspect, text

from app.core.config import get_settings
from app.core.database import engine
from app.core.logging import configure_logging
from app.domains.tasks.service import claim_and_run_one
from app.models.entities import AsyncJob


logger = logging.getLogger(__name__)


def verify_database_ready() -> None:
    """Verify the worker reached the migrated database before polling jobs."""
    with engine.connect() as connection:
        inspector = inspect(connection)
        schema = inspector.default_schema_name
        database = connection.engine.url.database
        search_path = schema
        resolved_table = AsyncJob.__tablename__
        table_available = inspector.has_table(AsyncJob.__tablename__)
        if connection.dialect.name == "postgresql":
            database, schema, search_path, resolved_table = connection.execute(
                text(
                    "SELECT current_database(), current_schema(), "
                    "current_setting('search_path'), to_regclass(:table_name)::text"
                ),
                {"table_name": AsyncJob.__tablename__},
            ).one()
            table_available = resolved_table is not None

        logger.info(
            "Worker database connection verified: host=%s database=%s "
            "schema=%s search_path=%s async_jobs=%s",
            connection.engine.url.host,
            database,
            schema,
            search_path,
            resolved_table,
        )
        if not table_available:
            raise RuntimeError(
                f"Required table {AsyncJob.__tablename__} is not available in database "
                f"{database} with search_path {search_path}; run Alembic migrations "
                "before the worker"
            )


def main():
    configure_logging(); settings=get_settings()
    if settings.task_mode != "database":
        raise SystemExit("Worker requires TASK_MODE=database")
    verify_database_ready()
    stopped=False
    def stop(*_):
        nonlocal stopped; stopped=True
    signal.signal(signal.SIGTERM,stop); signal.signal(signal.SIGINT,stop)
    while not stopped:
        if not claim_and_run_one(): time.sleep(1.0)

if __name__=="__main__": main()
