from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ORMModel


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    name: str = Field(min_length=1, max_length=200)
    accept_terms: bool
    accept_privacy: bool

    @field_validator("accept_terms", "accept_privacy")
    @classmethod
    def must_accept(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Consent is required")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=500)
    new_password: str = Field(min_length=10, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=20, max_length=500)


class UserView(ORMModel):
    id: uuid.UUID
    email: EmailStr
    role: str
    is_email_verified: bool
    is_active: bool
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserView
    email_verification_required: bool = False
    dev_verification_token: str | None = None


class ForgotResponse(BaseModel):
    message: str
    dev_reset_token: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)
