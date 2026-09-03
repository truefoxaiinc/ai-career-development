from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import httpx
import pytest

from app.ai.gateway import (
    LiteLLMCostLimitError,
    LiteLLMGateway,
    LiteLLMNotConfiguredError,
    LiteLLMResponseError,
    LiteLLMTimeoutError,
)
from app.core.config import Settings


def make_settings(**overrides):
    values = {
        "litellm_base_url": "http://litellm.test/v1",
        "litellm_api_key": "test-key",
        "litellm_model": "test-model",
        "llm_timeout_seconds": 5,
        "llm_max_cost_usd_per_request": 0.10,
    }
    values.update(overrides)
    return Settings(**values)


def make_user():
    return SimpleNamespace(id=uuid4())


class FakeResponse:
    def __init__(
        self,
        body=None,
        *,
        status_code=200,
        headers=None,
        json_error=None,
    ):
        self._body = body
        self.status_code = status_code
        self.headers = headers or {}
        self._json_error = json_error

    def json(self):
        if self._json_error:
            raise self._json_error
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request(
                "POST",
                "http://litellm.test/v1/chat/completions",
            )
            response = httpx.Response(
                self.status_code,
                request=request,
            )
            raise httpx.HTTPStatusError(
                "provider error",
                request=request,
                response=response,
            )


class FakeClient:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def post(self, *args, **kwargs):
        if self.error:
            raise self.error
        return self.response


def patch_client(monkeypatch, *, response=None, error=None):
    monkeypatch.setattr(
        "app.ai.gateway.httpx.Client",
        lambda *args, **kwargs: FakeClient(
            response=response,
            error=error,
        ),
    )


def test_gateway_not_configured():
    gateway = LiteLLMGateway(
        make_settings(
            litellm_base_url=None,
            litellm_api_key=None,
            litellm_model=None,
        )
    )

    with pytest.raises(LiteLLMNotConfiguredError):
        gateway.complete_json(
            db=MagicMock(),
            user=make_user(),
            feature="test",
            system="Return JSON.",
            payload={"hello": "world"},
        )


def test_gateway_success(monkeypatch):
    response = FakeResponse(
        {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {"skills": ["Python", "FastAPI"]}
                        )
                    }
                }
            ],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 5,
            },
            "estimated_cost": 0.001,
        }
    )

    patch_client(monkeypatch, response=response)

    db = MagicMock()
    gateway = LiteLLMGateway(make_settings())

    result = gateway.complete_json(
        db=db,
        user=make_user(),
        feature="resume_extraction",
        system="Return JSON.",
        payload={"resume": "Python developer"},
    )

    assert result == {
        "skills": ["Python", "FastAPI"]
    }

    db.add.assert_called_once()


def test_gateway_timeout(monkeypatch):
    patch_client(
        monkeypatch,
        error=httpx.ReadTimeout("provider timed out"),
    )

    gateway = LiteLLMGateway(make_settings())

    with pytest.raises(LiteLLMTimeoutError):
        gateway.complete_json(
            db=MagicMock(),
            user=make_user(),
            feature="test",
            system="Return JSON.",
            payload={},
        )


def test_gateway_http_error(monkeypatch):
    patch_client(
        monkeypatch,
        response=FakeResponse(
            {},
            status_code=500,
        ),
    )

    gateway = LiteLLMGateway(make_settings())

    with pytest.raises(LiteLLMResponseError):
        gateway.complete_json(
            db=MagicMock(),
            user=make_user(),
            feature="test",
            system="Return JSON.",
            payload={},
        )


def test_gateway_invalid_provider_json(monkeypatch):
    patch_client(
        monkeypatch,
        response=FakeResponse(
            json_error=ValueError("invalid json")
        ),
    )

    gateway = LiteLLMGateway(make_settings())

    with pytest.raises(LiteLLMResponseError):
        gateway.complete_json(
            db=MagicMock(),
            user=make_user(),
            feature="test",
            system="Return JSON.",
            payload={},
        )


def test_gateway_invalid_message_json(monkeypatch):
    patch_client(
        monkeypatch,
        response=FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": "not-json"
                        }
                    }
                ],
                "usage": {},
            }
        ),
    )

    gateway = LiteLLMGateway(make_settings())

    with pytest.raises(LiteLLMResponseError):
        gateway.complete_json(
            db=MagicMock(),
            user=make_user(),
            feature="test",
            system="Return JSON.",
            payload={},
        )


def test_gateway_empty_content(monkeypatch):
    patch_client(
        monkeypatch,
        response=FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": ""
                        }
                    }
                ],
                "usage": {},
            }
        ),
    )

    gateway = LiteLLMGateway(make_settings())

    with pytest.raises(LiteLLMResponseError):
        gateway.complete_json(
            db=MagicMock(),
            user=make_user(),
            feature="test",
            system="Return JSON.",
            payload={},
        )


def test_gateway_missing_choices(monkeypatch):
    patch_client(
        monkeypatch,
        response=FakeResponse(
            {
                "choices": [],
                "usage": {},
            }
        ),
    )

    gateway = LiteLLMGateway(make_settings())

    with pytest.raises(LiteLLMResponseError):
        gateway.complete_json(
            db=MagicMock(),
            user=make_user(),
            feature="test",
            system="Return JSON.",
            payload={},
        )


def test_gateway_rejects_excessive_cost(monkeypatch):
    patch_client(
        monkeypatch,
        response=FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": "{}"
                        }
                    }
                ],
                "usage": {},
                "estimated_cost": 0.25,
            }
        ),
    )

    gateway = LiteLLMGateway(
        make_settings(
            llm_max_cost_usd_per_request=0.10
        )
    )

    with pytest.raises(LiteLLMCostLimitError):
        gateway.complete_json(
            db=MagicMock(),
            user=make_user(),
            feature="test",
            system="Return JSON.",
            payload={},
        )