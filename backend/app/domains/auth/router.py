from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.security import clear_auth_cookies, get_current_user, set_auth_cookies
from app.models.entities import User
from app.schemas.common import success
from .schemas import ChangePasswordRequest, ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest, UserView, VerifyEmailRequest
from .service import (
    authenticate,
    change_password,
    build_oidc_start,
    complete_oidc,
    issue_session,
    register,
    request_password_reset,
    reset_password,
    revoke_refresh,
    rotate_refresh,
    verify_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register_endpoint(payload: RegisterRequest, response: Response, db: Annotated[Session, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings)]):
    user, dev_token = register(db, payload, settings)
    access, refresh = issue_session(db, user, settings); db.commit(); set_auth_cookies(response, access, refresh, settings)
    return success({"user": UserView.model_validate(user).model_dump(mode="json"), "email_verification_required": True, "dev_verification_token": dev_token})


@router.post("/login")
def login_endpoint(payload: LoginRequest, response: Response, db: Annotated[Session, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings)]):
    user = authenticate(db, payload.email, payload.password)
    access, refresh = issue_session(db, user, settings); db.commit(); set_auth_cookies(response, access, refresh, settings)
    return success({"user": UserView.model_validate(user).model_dump(mode="json"), "email_verification_required": not user.is_email_verified})


@router.post("/refresh")
def refresh_endpoint(response: Response, db: Annotated[Session, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings)], cp_refresh: Annotated[str | None, Cookie()] = None):
    if not cp_refresh: raise HTTPException(status_code=401, detail="Refresh session is missing")
    user, access, refresh = rotate_refresh(db, cp_refresh, settings); set_auth_cookies(response, access, refresh, settings)
    return success({"user": UserView.model_validate(user).model_dump(mode="json")})


@router.post("/logout")
def logout_endpoint(response: Response, db: Annotated[Session, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings)], cp_refresh: Annotated[str | None, Cookie()] = None):
    revoke_refresh(db, cp_refresh); clear_auth_cookies(response, settings); return success({"message":"Logged out"})


@router.get("/session")
def session_endpoint(user: Annotated[User, Depends(get_current_user)]):
    return success({"user": UserView.model_validate(user).model_dump(mode="json")})


@router.post("/change-password")
def change_password_endpoint(payload: ChangePasswordRequest, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
    change_password(db, user, payload.current_password, payload.new_password)
    return success({"message":"Password changed"})


@router.post("/verify-email")
def verify_email_endpoint(payload: VerifyEmailRequest, db: Annotated[Session, Depends(get_db)]):
    user = verify_email(db, payload.token); return success({"user": UserView.model_validate(user).model_dump(mode="json")})


@router.post("/forgot-password", status_code=202)
def forgot_password_endpoint(payload: ForgotPasswordRequest, db: Annotated[Session, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings)]):
    token = request_password_reset(db, payload.email, settings)
    data={"message":"If the account exists, password-reset instructions have been issued."}
    if token: data["dev_reset_token"]=token
    return success(data)


@router.post("/reset-password")
def reset_password_endpoint(payload: ResetPasswordRequest, db: Annotated[Session, Depends(get_db)]):
    reset_password(db, payload.token, payload.new_password); return success({"message":"Password reset complete"})


@router.get("/oidc/start")
def oidc_start(settings: Annotated[Settings, Depends(get_settings)], redirect_to: str = Query("/dashboard/profile")):
    url, state, verifier = build_oidc_start(settings, redirect_to)
    response=RedirectResponse(url, status_code=302)
    cookie_args={"httponly":True,"secure":settings.cookie_secure,"samesite":"lax","max_age":600,"path":"/"}
    response.set_cookie("cp_oidc_state",state,**cookie_args); response.set_cookie("cp_oidc_verifier",verifier,**cookie_args)
    return response


@router.get("/oidc/callback")
def oidc_callback(code: str, state: str, db: Annotated[Session, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings)], cp_oidc_state: Annotated[str | None, Cookie()] = None, cp_oidc_verifier: Annotated[str | None, Cookie()] = None):
    user, redirect_to = complete_oidc(db, settings, code, state, cp_oidc_state, cp_oidc_verifier)
    access, refresh = issue_session(db, user, settings); db.commit()
    response=RedirectResponse(settings.frontend_url.rstrip("/")+redirect_to, status_code=302); set_auth_cookies(response,access,refresh,settings)
    response.delete_cookie("cp_oidc_state",path="/"); response.delete_cookie("cp_oidc_verifier",path="/")
    return response
