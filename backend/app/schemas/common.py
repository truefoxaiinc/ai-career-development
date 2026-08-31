from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SuccessEnvelope(BaseModel, Generic[T]):
    ok: bool = True
    data: T


class MessageData(BaseModel):
    message: str


def success(data: Any) -> dict[str, Any]:
    return {"ok": True, "data": data}
