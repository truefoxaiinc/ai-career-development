from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections import defaultdict, deque
from urllib.parse import urlparse

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .config import get_settings

logger = logging.getLogger("careerpilot.request")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers["x-request-id"] = request.state.request_id
        logger.info("request_complete", extra={
            "request_id": request.state.request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "latency_ms": elapsed_ms,
        })
        return response


class OriginGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            if origin:
                settings = get_settings()
                allowed = {x.rstrip("/") for x in settings.cors_origins}
                if origin.rstrip("/") not in allowed:
                    return JSONResponse(status_code=403, content={"ok": False, "error": {"code": "origin_rejected", "message": "Origin is not allowed", "fields": []}})
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Development-safe fixed-window limiter. Production deployments should set VALKEY_URL.

    It intentionally avoids storing request bodies, identities or PII.
    """
    _events: dict[str, deque[float]] = defaultdict(deque)
    _lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        if request.url.path in {"/health", "/ready"}:
            return await call_next(request)
        forwarded = request.headers.get("x-forwarded-for", "")
        ip = forwarded.split(",", 1)[0].strip() or (request.client.host if request.client else "unknown")
        key = f"{ip}:{request.url.path}"
        now = time.monotonic()
        async with self._lock:
            q = self._events[key]
            while q and q[0] < now - 60:
                q.popleft()
            if len(q) >= settings.rate_limit_per_minute:
                return JSONResponse(status_code=429, content={"ok": False, "error": {"code": "rate_limited", "message": "Too many requests", "fields": []}}, headers={"Retry-After": "60"})
            q.append(now)
        return await call_next(request)
