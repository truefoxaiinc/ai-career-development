from __future__ import annotations

import stat
from pathlib import Path

import pytest

from app.core.config import Settings
from app.integrations.storage import LocalObjectStorage, get_storage


PRODUCTION_DEFAULTS = {
    "environment": "production",
    "jwt_secret": "a-production-secret-that-is-longer-than-32-bytes",
    "cookie_secure": True,
    "auth_mode": "local",
    "smtp_host": "smtp.example.test",
    "smtp_from_email": "careerpilot@example.test",
    "enable_dev_job_provider": False,
}


def production_settings(**overrides) -> Settings:
    return Settings(**{**PRODUCTION_DEFAULTS, **overrides})


def test_production_local_storage_requires_explicit_opt_in(tmp_path: Path):
    settings = production_settings(
        storage_backend="local",
        local_storage_dir=tmp_path,
    )

    with pytest.raises(RuntimeError, match="ALLOW_LOCAL_STORAGE_IN_PRODUCTION"):
        settings.validate_runtime()


def test_production_local_storage_accepts_explicit_absolute_path(tmp_path: Path):
    settings = production_settings(
        storage_backend="local",
        allow_local_storage_in_production=True,
        local_storage_dir=tmp_path,
    )

    settings.validate_runtime()
    assert isinstance(get_storage(settings), LocalObjectStorage)


def test_local_storage_opt_in_does_not_bypass_other_production_checks(tmp_path: Path):
    settings = production_settings(
        jwt_secret="weak",
        storage_backend="local",
        allow_local_storage_in_production=True,
        local_storage_dir=tmp_path,
    )

    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        settings.validate_runtime()


def test_production_local_storage_rejects_relative_path():
    settings = production_settings(
        storage_backend="local",
        allow_local_storage_in_production=True,
        local_storage_dir=Path("relative-storage"),
    )

    with pytest.raises(RuntimeError, match="absolute path"):
        settings.validate_runtime()


def test_production_s3_requires_bucket():
    settings = production_settings(storage_backend="s3", s3_bucket=None)

    with pytest.raises(RuntimeError, match="S3_BUCKET"):
        settings.validate_runtime()


def test_s3_backend_is_selected_without_fallback(monkeypatch):
    created = object()
    monkeypatch.setattr(
        "app.integrations.storage.S3ObjectStorage",
        lambda settings: created,
    )
    settings = production_settings(storage_backend="s3", s3_bucket="private-bucket")

    settings.validate_runtime()
    assert get_storage(settings) is created


def test_local_storage_put_get_delete_and_persists_between_instances(tmp_path: Path):
    first = LocalObjectStorage(tmp_path)
    first.put_bytes("resumes/user-id/file.pdf", b"private", "application/pdf")

    second = LocalObjectStorage(tmp_path)
    assert second.get_bytes("resumes/user-id/file.pdf") == b"private"
    stored_file = tmp_path / "resumes" / "user-id" / "file.pdf"
    if stat.S_IMODE(stored_file.stat().st_mode):
        assert stat.S_IMODE(stored_file.stat().st_mode) & 0o077 == 0

    second.delete("resumes/user-id/file.pdf")
    assert not stored_file.exists()
    second.delete("resumes/user-id/file.pdf")


@pytest.mark.parametrize("key", ["../outside", "/absolute", "nested/../../outside"])
def test_local_storage_rejects_path_traversal(tmp_path: Path, key: str):
    storage = LocalObjectStorage(tmp_path / "storage")

    with pytest.raises(ValueError, match="Invalid storage key"):
        storage.put_bytes(key, b"no", "application/octet-stream")


def test_local_storage_rejects_symlink_escape(tmp_path: Path):
    storage_root = tmp_path / "storage"
    outside = tmp_path / "outside"
    storage = LocalObjectStorage(storage_root)
    outside.mkdir()
    try:
        (storage_root / "escape").symlink_to(outside, target_is_directory=True)
    except (NotImplementedError, OSError):
        pytest.skip("directory symlinks are not available")

    with pytest.raises(ValueError, match="Invalid storage key"):
        storage.put_bytes("escape/private.pdf", b"no", "application/pdf")
