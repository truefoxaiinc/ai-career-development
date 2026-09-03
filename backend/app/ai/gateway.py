from __future__ import annotations

import json
import time
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import AIUsageLog, User


class LiteLLMGatewayError(RuntimeError):
    """Base error for LiteLLM gateway failures."""


class LiteLLMNotConfiguredError(LiteLLMGatewayError):
    pass


class LiteLLMTimeoutError(LiteLLMGatewayError):
    pass


class LiteLLMResponseError(LiteLLMGatewayError):
    pass


class LiteLLMCostLimitError(LiteLLMGatewayError):
    pass


class LiteLLMGateway:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def configured(self) -> bool:
        return bool(
            self.settings.litellm_base_url
            and self.settings.litellm_api_key
            and self.settings.litellm_model
        )

    def complete_json(
        self,
        *,
        db: Session,
        user: User,
        feature: str,
        system: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        if not self.configured:
            raise LiteLLMNotConfiguredError(
                "LiteLLM gateway is not configured"
            )

        url = (
            self.settings.litellm_base_url.rstrip("/")
            + "/chat/completions"
        )

        started = time.perf_counter()

        try:
            with httpx.Client(
                timeout=self.settings.llm_timeout_seconds
            ) as client:
                response = client.post(
                    url,
                    headers={
                        "Authorization":
                            f"Bearer {self.settings.litellm_api_key}"
                    },
                    json={
                        "model": self.settings.litellm_model,
                        "temperature": 0.1,
                        "response_format": {
                            "type": "json_object"
                        },
                        "messages": [
                            {
                                "role": "system",
                                "content": system,
                            },
                            {
                                "role": "user",
                                "content": json.dumps(
                                    payload,
                                    ensure_ascii=False,
                                ),
                            },
                        ],
                    },
                )

                response.raise_for_status()

        except httpx.TimeoutException as exc:
            raise LiteLLMTimeoutError(
                "LiteLLM request timed out"
            ) from exc

        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code

            raise LiteLLMResponseError(
                f"LiteLLM returned HTTP {status}"
            ) from exc

        except httpx.HTTPError as exc:
            raise LiteLLMResponseError(
                "LiteLLM request failed"
            ) from exc

        latency_ms = int(
            (time.perf_counter() - started) * 1000
        )

        try:
            body = response.json()
        except ValueError as exc:
            raise LiteLLMResponseError(
                "LiteLLM returned invalid JSON"
            ) from exc

        usage = body.get("usage") or {}

        estimated_cost = self._extract_cost(
            body=body,
            response=response,
        )

        if estimated_cost > Decimal(
            str(self.settings.llm_max_cost_usd_per_request)
        ):
            raise LiteLLMCostLimitError(
                "LiteLLM request exceeded configured cost limit"
            )

        self._record_usage(
            db=db,
            user=user,
            feature=feature,
            usage=usage,
            latency_ms=latency_ms,
            estimated_cost=estimated_cost,
        )

        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LiteLLMResponseError(
                "LiteLLM response did not contain message content"
            ) from exc

        if not isinstance(content, str) or not content.strip():
            raise LiteLLMResponseError(
                "LiteLLM returned empty message content"
            )

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise LiteLLMResponseError(
                "LiteLLM message content was not valid JSON"
            ) from exc

        if not isinstance(parsed, dict):
            raise LiteLLMResponseError(
                "LiteLLM JSON response must be an object"
            )

        return parsed

    def _record_usage(
        self,
        *,
        db: Session,
        user: User,
        feature: str,
        usage: dict[str, Any],
        latency_ms: int,
        estimated_cost: Decimal,
    ) -> None:
        db.add(
            AIUsageLog(
                user_id=user.id,
                feature=feature,
                provider="litellm",
                model=self.settings.litellm_model or "unknown",
                input_tokens=int(
                    usage.get("prompt_tokens", 0) or 0
                ),
                output_tokens=int(
                    usage.get("completion_tokens", 0) or 0
                ),
                latency_ms=latency_ms,
                estimated_cost_usd=estimated_cost,
            )
        )

    @staticmethod
    def _extract_cost(
        *,
        body: dict[str, Any],
        response: httpx.Response,
    ) -> Decimal:
        candidates = [
            body.get("estimated_cost"),
            body.get("response_cost"),
            response.headers.get("x-litellm-response-cost"),
        ]

        for value in candidates:
            if value in (None, ""):
                continue

            try:
                cost = Decimal(str(value))

                if cost >= 0:
                    return cost
            except (InvalidOperation, ValueError):
                continue

        return Decimal("0")