from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol

from app.core.config import Settings, get_settings


class ObjectStorage(Protocol):
    def put_bytes(self, key: str, data: bytes, content_type: str) -> str: ...
    def get_bytes(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...


class LocalObjectStorage:
    """Development/test adapter. Never enabled in production by Settings.validate_runtime."""

    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents and path != self.root:
            raise ValueError("Invalid storage key")
        return path

    def put_bytes(self, key: str, data: bytes, content_type: str) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def get_bytes(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def delete(self, key: str) -> None:
        path = self._path(key)
        try:
            path.unlink()
        except FileNotFoundError:
            pass


class S3ObjectStorage:
    def __init__(self, settings: Settings):
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError("boto3 is required when STORAGE_BACKEND=s3") from exc
        self.bucket = settings.s3_bucket
        if not self.bucket:
            raise RuntimeError("S3_BUCKET is required")
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )

    def put_bytes(self, key: str, data: bytes, content_type: str) -> str:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type, ServerSideEncryption="AES256")
        return key

    def get_bytes(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


def get_storage(settings: Settings | None = None) -> ObjectStorage:
    settings = settings or get_settings()
    if settings.storage_backend == "s3":
        return S3ObjectStorage(settings)
    return LocalObjectStorage(settings.local_storage_dir)
