from __future__ import annotations

import json
import time
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import AIUsageLog, User


class LiteLLMGateway:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def configured(self) -> bool:
        return bool(self.settings.litellm_base_url and self.settings.litellm_api_key and self.settings.litellm_model)

    def complete_json(self, *, db: Session, user: User, feature: str, system: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.configured:
            raise RuntimeError("LiteLLM gateway is not configured")
        url = self.settings.litellm_base_url.rstrip("/") + "/chat/completions"
        started = time.perf_counter()
        with httpx.Client(timeout=self.settings.llm_timeout_seconds) as client:
            response = client.post(
                url,
                headers={"Authorization": f"Bearer {self.settings.litellm_api_key}"},
                json={
                    "model": self.settings.litellm_model,
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                    ],
                },
            )
            response.raise_for_status()
            body = response.json()
        usage = body.get("usage") or {}
        latency_ms = int((time.perf_counter() - started) * 1000)
        db.add(AIUsageLog(
            user_id=user.id,
            feature=feature,
            provider="litellm",
            model=self.settings.litellm_model or "unknown",
            input_tokens=int(usage.get("prompt_tokens", 0)),
            output_tokens=int(usage.get("completion_tokens", 0)),
            latency_ms=latency_ms,
            estimated_cost_usd=Decimal(str(body.get("estimated_cost", 0) or 0)),
        ))
        content = body["choices"][0]["message"]["content"]
        return json.loads(content)
