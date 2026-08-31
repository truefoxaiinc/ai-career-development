from __future__ import annotations

import base64
import hashlib
import secrets
import smtplib
import ssl
import uuid
from email.message import EmailMessage
from datetime import UTC, datetime, timedelta

import httpx
import jwt
from fastapi import HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import create_access_token, hash_password, hash_token, new_opaque_token, verify_password
from app.models.entities import AuditLog, Candidate, ConsentRecord, EmailToken, RefreshSession, User
from .schemas import RegisterRequest



def _send_account_email(settings: Settings, recipient: str, subject: str, text: str) -> None:
    if settings.environment in {"development", "test"}:
        return
    if not settings.smtp_host or not settings.smtp_from_email:
        raise HTTPException(status_code=503, detail="Transactional email is not configured")
    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_starttls:
                server.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password or "")
            server.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise HTTPException(status_code=503, detail="Transactional email could not be delivered") from exc

def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def issue_email_token(db: Session, user: User, purpose: str, ttl_minutes: int) -> str:
    raw = new_opaque_token()
    db.add(EmailToken(user_id=user.id, purpose=purpose, token_hash=hash_token(raw), expires_at=datetime.now(UTC) + timedelta(minutes=ttl_minutes)))
    return raw


def issue_session(db: Session, user: User, settings: Settings) -> tuple[str, str]:
    raw_refresh = new_opaque_token()
    db.add(RefreshSession(user_id=user.id, token_hash=hash_token(raw_refresh), expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days)))
    user.last_login_at = datetime.now(UTC)
    return create_access_token(user, settings), raw_refresh


def register(db: Session, payload: RegisterRequest, settings: Settings) -> tuple[User, str | None]:
    email = payload.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    try:
        encoded = hash_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    user = User(email=email, password_hash=encoded, role="candidate")
    db.add(user)
    db.flush()
    db.add(Candidate(user_id=user.id, name=payload.name.strip()))
    for purpose in ("terms", "privacy"):
        db.add(ConsentRecord(user_id=user.id, purpose=purpose, policy_version="2026-08", granted=True, metadata_json={"source": "signup"}))
    db.add(AuditLog(user_id=user.id, action="account.registered", resource_type="user", resource_id=str(user.id), metadata_json={}))
    token = issue_email_token(db, user, "verify_email", 24 * 60)
    db.commit()
    _send_account_email(settings, user.email, "Verify your CareerPilot email", f"Verify your email: {settings.frontend_url.rstrip(chr(47))}/verify-email?token={token}")
    return user, token if settings.environment in {"development", "test"} else None


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower().strip()))
    # Same outward error for unknown account and invalid password.
    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return user


def consume_email_token(db: Session, raw: str, purpose: str) -> User:
    token = db.scalar(select(EmailToken).where(EmailToken.token_hash == hash_token(raw), EmailToken.purpose == purpose))
    if not token or token.used_at is not None or _aware(token.expires_at) < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token is invalid or expired")
    user = db.get(User, token.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Token account is unavailable")
    token.used_at = datetime.now(UTC)
    return user


def rotate_refresh(db: Session, raw: str, settings: Settings) -> tuple[User, str, str]:
    current = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == hash_token(raw)))
    if not current or current.revoked_at or _aware(current.expires_at) < datetime.now(UTC):
        raise HTTPException(status_code=401, detail="Refresh session is invalid or expired")
    user = db.get(User, current.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account unavailable")
    current.revoked_at = datetime.now(UTC)
    access, new_raw = issue_session(db, user, settings)
    db.commit()
    return user, access, new_raw


def revoke_refresh(db: Session, raw: str | None) -> None:
    if raw:
        current = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == hash_token(raw)))
        if current and not current.revoked_at:
            current.revoked_at = datetime.now(UTC)
            db.commit()


def request_password_reset(db: Session, email: str, settings: Settings) -> str | None:
    user = db.scalar(select(User).where(User.email == email.lower().strip()))
    if not user:
        return None
    raw = issue_email_token(db, user, "reset_password", 60)
    db.add(AuditLog(user_id=user.id, action="password.reset_requested", resource_type="user", resource_id=str(user.id), metadata_json={}))
    db.commit()
    _send_account_email(settings, user.email, "Reset your CareerPilot password", f"Reset your password: {settings.frontend_url.rstrip(chr(47))}/reset-password?token={raw}")
    return raw if settings.environment in {"development", "test"} else None


def reset_password(db: Session, raw: str, new_password: str) -> User:
    user = consume_email_token(db, raw, "reset_password")
    try:
        user.password_hash = hash_password(new_password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.execute(update(RefreshSession).where(RefreshSession.user_id == user.id, RefreshSession.revoked_at.is_(None)).values(revoked_at=datetime.now(UTC)))
    db.add(AuditLog(user_id=user.id, action="password.reset_completed", resource_type="user", resource_id=str(user.id), metadata_json={}))
    db.commit()
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not user.password_hash or not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    try:
        user.password_hash = hash_password(new_password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.execute(update(RefreshSession).where(RefreshSession.user_id == user.id, RefreshSession.revoked_at.is_(None)).values(revoked_at=datetime.now(UTC)))
    db.add(AuditLog(user_id=user.id, action="password.changed", resource_type="user", resource_id=str(user.id), metadata_json={}))
    db.commit()


def verify_email(db: Session, raw: str) -> User:
    user = consume_email_token(db, raw, "verify_email")
    user.is_email_verified = True
    db.add(AuditLog(user_id=user.id, action="email.verified", resource_type="user", resource_id=str(user.id), metadata_json={}))
    db.commit()
    return user


def build_oidc_start(settings: Settings, redirect_to: str = "/dashboard/profile") -> tuple[str, str, str]:
    if settings.auth_mode != "oidc" or not settings.oidc_authorization_endpoint or not settings.oidc_client_id or not settings.oidc_redirect_uri:
        raise HTTPException(status_code=503, detail="OIDC is not configured")
    state_id = secrets.token_urlsafe(24)
    nonce = secrets.token_urlsafe(24)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    signed_state = jwt.encode({"sid": state_id, "nonce": nonce, "redirect_to": redirect_to, "exp": datetime.now(UTC)+timedelta(minutes=10)}, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    params = httpx.QueryParams({
        "client_id": settings.oidc_client_id,
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": settings.oidc_redirect_uri,
        "state": signed_state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    return f"{settings.oidc_authorization_endpoint}?{params}", signed_state, verifier


def complete_oidc(db: Session, settings: Settings, code: str, state: str, state_cookie: str | None, verifier: str | None) -> tuple[User, str]:
    if not state_cookie or not secrets.compare_digest(state, state_cookie) or not verifier:
        raise HTTPException(status_code=400, detail="OIDC state validation failed")
    try:
        state_claims = jwt.decode(state, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=400, detail="OIDC state is invalid or expired") from exc
    if not settings.oidc_token_endpoint or not settings.oidc_client_id or not settings.oidc_client_secret or not settings.oidc_redirect_uri or not settings.oidc_jwks_uri or not settings.oidc_issuer:
        raise HTTPException(status_code=503, detail="OIDC is not fully configured")
    with httpx.Client(timeout=20.0) as client:
        resp = client.post(settings.oidc_token_endpoint, data={"grant_type":"authorization_code","code":code,"redirect_uri":settings.oidc_redirect_uri,"client_id":settings.oidc_client_id,"client_secret":settings.oidc_client_secret,"code_verifier":verifier})
        resp.raise_for_status()
        token_body = resp.json()
    id_token = token_body.get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="OIDC provider did not return an ID token")
    signing_key = jwt.PyJWKClient(settings.oidc_jwks_uri).get_signing_key_from_jwt(id_token)
    claims = jwt.decode(id_token, signing_key.key, algorithms=[signing_key.algorithm_name or "RS256"], audience=settings.oidc_client_id, issuer=settings.oidc_issuer)
    if claims.get("nonce") != state_claims.get("nonce"):
        raise HTTPException(status_code=400, detail="OIDC nonce validation failed")
    subject = str(claims.get("sub") or "")
    email = str(claims.get("email") or "").lower()
    if not subject or not email:
        raise HTTPException(status_code=400, detail="OIDC provider must supply subject and email claims")
    user = db.scalar(select(User).where((User.oidc_subject == subject) | (User.email == email)))
    if not user:
        user = User(email=email, oidc_subject=subject, is_email_verified=bool(claims.get("email_verified", True)), role="candidate")
        db.add(user); db.flush(); db.add(Candidate(user_id=user.id, name=str(claims.get("name") or "")))
    else:
        user.oidc_subject = user.oidc_subject or subject
        if claims.get("email_verified"):
            user.is_email_verified = True
    db.commit()
    return user, str(state_claims.get("redirect_to") or "/dashboard/profile")
