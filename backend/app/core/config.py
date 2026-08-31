from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    app_name: str = "CareerPilot API"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./careerpilot-dev.db"
    frontend_url: str = "http://localhost:3000"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    jwt_secret: str = "development-only-change-me-use-at-least-32-bytes"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    cookie_secure: bool = False
    cookie_domain: str | None = None

    auth_mode: Literal["local", "oidc"] = "local"
    oidc_issuer: str | None = None
    oidc_client_id: str | None = None
    oidc_client_secret: str | None = None
    oidc_authorization_endpoint: str | None = None
    oidc_token_endpoint: str | None = None
    oidc_jwks_uri: str | None = None
    oidc_redirect_uri: str | None = None

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_starttls: bool = True

    upload_max_bytes: int = 10 * 1024 * 1024
    storage_backend: Literal["local", "s3"] = "local"
    local_storage_dir: Path = Path("./.careerpilot-storage")
    s3_bucket: str | None = None
    s3_endpoint_url: str | None = None
    s3_region: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None

    task_mode: Literal["inline", "database"] = "inline"
    valkey_url: str | None = None
    rate_limit_per_minute: int = 120

    litellm_base_url: str | None = None
    litellm_api_key: str | None = None
    litellm_model: str | None = None
    llm_timeout_seconds: float = 45.0
    llm_max_cost_usd_per_request: float = 0.10

    matching_weights_json: str = '{"skills":0.30,"experience":0.20,"education":0.15,"domain":0.15,"tools":0.10,"preferences":0.05,"additional":0.05}'

    adzuna_app_id: str | None = None
    adzuna_app_key: str | None = None
    adzuna_country: str = "in"
    jooble_api_key: str | None = None
    usajobs_api_key: str | None = None
    usajobs_user_agent_email: str | None = None
    reed_api_key: str | None = None
    enable_dev_job_provider: bool = True
    job_provider_targets_json: str = "{}"

    retention_days: int = 365

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            if value.startswith("["):
                return json.loads(value)
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def matching_weights(self) -> dict[str, float]:
        raw = json.loads(self.matching_weights_json)
        total = sum(float(v) for v in raw.values())
        if total <= 0:
            raise ValueError("MATCHING_WEIGHTS_JSON must sum to a positive value")
        return {str(k): float(v) / total for k, v in raw.items()}

    @property
    def job_provider_targets(self) -> dict[str, list[str]]:
        parsed = json.loads(self.job_provider_targets_json or "{}")
        return {str(k): [str(x) for x in v] for k, v in parsed.items()}

    def validate_runtime(self) -> None:
        if self.environment == "production":
            if self.jwt_secret.startswith("development-only-change-me") or len(self.jwt_secret) < 32:
                raise RuntimeError("JWT_SECRET must be a strong secret in production")
            if self.auth_mode == "oidc" and not all([
                self.oidc_issuer,
                self.oidc_client_id,
                self.oidc_client_secret,
                self.oidc_authorization_endpoint,
                self.oidc_token_endpoint,
                self.oidc_jwks_uri,
                self.oidc_redirect_uri,
            ]):
                raise RuntimeError("OIDC configuration is incomplete")
            if self.auth_mode == "local" and not (self.smtp_host and self.smtp_from_email):
                raise RuntimeError("Local authentication in production requires SMTP_HOST and SMTP_FROM_EMAIL")
            if self.storage_backend == "local":
                raise RuntimeError("Production must use S3-compatible object storage")
            if self.enable_dev_job_provider:
                raise RuntimeError("ENABLE_DEV_JOB_PROVIDER must be false in production")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_runtime()
    return settings
