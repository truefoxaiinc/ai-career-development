from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import router as api_v1_router
from app.core.config import get_settings
from app.core.database import engine
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import (
    OriginGuardMiddleware,
    RateLimitMiddleware,
    RequestContextMiddleware,
)


# Configure logging before creating the application.
configure_logging()

# Load application settings.
settings = get_settings()


app = FastAPI(
    title="CareerPilot API",
    version="1.0.0",
    description=(
        "Versioned API for CareerPilot candidate workflows. "
        "Development adapters are never enabled by production configuration."
    ),
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)


# ---------------------------------------------------------------------------
# Custom middleware
#
# FastAPI/Starlette executes the last-added middleware first.
# CORS is therefore added last so it wraps all responses, including errors
# returned by OriginGuardMiddleware and RateLimitMiddleware.
# ---------------------------------------------------------------------------

app.add_middleware(OriginGuardMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestContextMiddleware)


# Allow the frontend development server to access the API.
cors_origins = list(settings.cors_origins or [])

# Ensure standard local development origins are available outside production.
if settings.environment != "production":
    development_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    for origin in development_origins:
        if origin not in cors_origins:
            cors_origins.append(origin)


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Accept",
        "Content-Type",
        "Authorization",
        "X-Request-ID",
    ],
    expose_headers=[
        "X-Request-ID",
    ],
    max_age=600,
)


# Register application error handlers.
install_error_handlers(app)


# Register versioned API routes.
app.include_router(
    api_v1_router,
    prefix=settings.api_prefix,
)


@app.get(
    "/health",
    tags=["ops"],
    summary="Application health check",
)
def health() -> dict[str, str]:
    """Return the application's basic health status."""

    return {"status": "ok"}


@app.get(
    "/ready",
    tags=["ops"],
    summary="Application readiness check",
)
def ready() -> dict[str, str]:
    """Check whether the application can connect to the database."""

    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {"status": "ready"}