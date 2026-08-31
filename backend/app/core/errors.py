from __future__ import annotations

import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def error_payload(request: Request, code: str, message: str, *, fields=None):
    return {
        "ok": False,
        "error": {
            "code": code,
            "message": message,
            "fields": fields or [],
            "request_id": getattr(request.state, "request_id", None),
        },
    }


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        fields = []
        for item in exc.errors():
            fields.append({
                "field": ".".join(str(p) for p in item.get("loc", [])[1:]),
                "message": item.get("msg", "Invalid value"),
                "type": item.get("type", "validation_error"),
            })
        return JSONResponse(status_code=422, content=error_payload(request, "validation_error", "Request validation failed", fields=fields))

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        message = exc.detail if isinstance(exc.detail, str) else "Request failed"
        code = "not_found" if exc.status_code == 404 else "forbidden" if exc.status_code == 403 else "unauthorized" if exc.status_code == 401 else "request_error"
        return JSONResponse(status_code=exc.status_code, content=error_payload(request, code, message))

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        # Never serialize exception contents: they may include PII or provider tokens.
        return JSONResponse(status_code=500, content=error_payload(request, "internal_error", "An unexpected server error occurred"))
