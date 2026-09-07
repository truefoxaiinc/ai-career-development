from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from app.ai.gateway import LiteLLMTimeoutError
from app.core.config import Settings
from app.domains.documents import service


def _candidate():
    return SimpleNamespace(
        id=uuid4(),
        name="Test Candidate",
        headline="Python Backend Developer",
        location="Bangalore",
        profile_summary="Backend engineer.",
    )


def _entry():
    return SimpleNamespace(
        id=uuid4(),
        entry_type="skill",
        label="Python",
        structured_data={"name": "Python"},
        source_text="Python",
        verified=True,
    )


def _job():
    return SimpleNamespace(
        id=uuid4(),
        title="Backend Engineer",
        company="Example Company",
        description="Python backend role.",
        requirements={
            "skills": ["Python"],
            "experience_years": None,
        },
    )


def _setup(monkeypatch):
    candidate = _candidate()
    entry = _entry()

    monkeypatch.setattr(
        service,
        "candidate_for_user",
        lambda db, user: candidate,
    )

    monkeypatch.setattr(
        service,
        "_verified_entries",
        lambda db, candidate_id: [entry],
    )

    return candidate, entry


def test_grounded_ai_document_uses_litellm_generator(
    monkeypatch,
):
    _setup(monkeypatch)

    class Gateway:
        configured = True

    monkeypatch.setattr(
        service,
        "LiteLLMGateway",
        lambda settings: Gateway(),
    )

    monkeypatch.setattr(
        service,
        "_llm_generate",
        lambda *args, **kwargs: (
            "Python Backend Developer\n"
            "Verified skill: Python"
        ),
    )

    monkeypatch.setattr(
        service,
        "verify_document_claims",
        lambda *args, **kwargs: {
            "status": "passed",
            "unsupported_claims": 0,
            "claims": [],
        },
    )

    db = MagicMock()
    db.scalar.return_value = None

    document = service.generate_document(
        db=db,
        user=SimpleNamespace(id=uuid4()),
        settings=Settings(),
        job=_job(),
        document_type="resume",
        template="ats",
    )

    assert document.generator == "litellm-grounded"
    assert document.claim_report["unsupported_claims"] == 0
    assert "Python" in document.content


def test_document_ai_timeout_falls_back_to_deterministic(
    monkeypatch,
):
    _setup(monkeypatch)

    class Gateway:
        configured = True

    monkeypatch.setattr(
        service,
        "LiteLLMGateway",
        lambda settings: Gateway(),
    )

    def timeout(*args, **kwargs):
        raise LiteLLMTimeoutError("timeout")

    monkeypatch.setattr(
        service,
        "_llm_generate",
        timeout,
    )

    monkeypatch.setattr(
        service,
        "_deterministic_resume",
        lambda *args, **kwargs: (
            "Test Candidate\n"
            "Python Backend Developer\n"
            "SKILLS\n"
            "Python"
        ),
    )

    monkeypatch.setattr(
        service,
        "verify_document_claims",
        lambda *args, **kwargs: {
            "status": "passed",
            "unsupported_claims": 0,
            "claims": [],
        },
    )

    db = MagicMock()
    db.scalar.return_value = None

    document = service.generate_document(
        db=db,
        user=SimpleNamespace(id=uuid4()),
        settings=Settings(),
        job=_job(),
        document_type="resume",
        template="ats",
    )

    assert document.generator == "deterministic-ai-fallback"
    assert document.claim_report["unsupported_claims"] == 0
    assert "Python" in document.content


def test_unsupported_ai_claim_remains_blocked(
    monkeypatch,
):
    _setup(monkeypatch)

    class Gateway:
        configured = True

    monkeypatch.setattr(
        service,
        "LiteLLMGateway",
        lambda settings: Gateway(),
    )

    monkeypatch.setattr(
        service,
        "_llm_generate",
        lambda *args, **kwargs: (
            "Led 500 engineers at Google "
            "and increased revenue by 900%."
        ),
    )

    monkeypatch.setattr(
        service,
        "verify_document_claims",
        lambda *args, **kwargs: {
            "status": "failed",
            "unsupported_claims": 1,
            "claims": [
                {
                    "claim": "Led 500 engineers at Google",
                    "supported": False,
                }
            ],
        },
    )

    db = MagicMock()
    db.scalar.return_value = None

    document = service.generate_document(
        db=db,
        user=SimpleNamespace(id=uuid4()),
        settings=Settings(),
        job=_job(),
        document_type="resume",
        template="ats",
    )

    assert document.generator == "litellm-grounded"
    assert document.claim_report["unsupported_claims"] == 1
    assert document.approved_at is None


def test_disabled_ai_keeps_deterministic_generation(
    monkeypatch,
):
    _setup(monkeypatch)

    class Gateway:
        configured = False

    monkeypatch.setattr(
        service,
        "LiteLLMGateway",
        lambda settings: Gateway(),
    )

    def must_not_call_ai(*args, **kwargs):
        raise AssertionError(
            "LLM must not be called when disabled"
        )

    monkeypatch.setattr(
        service,
        "_llm_generate",
        must_not_call_ai,
    )

    monkeypatch.setattr(
        service,
        "_deterministic_cover_letter",
        lambda *args, **kwargs: (
            "Dear Example Company hiring team,\n\n"
            "Verified skill: Python.\n\n"
            "Sincerely,\n"
            "Test Candidate"
        ),
    )

    monkeypatch.setattr(
        service,
        "verify_document_claims",
        lambda *args, **kwargs: {
            "status": "passed",
            "unsupported_claims": 0,
            "claims": [],
        },
    )

    db = MagicMock()
    db.scalar.return_value = None

    document = service.generate_document(
        db=db,
        user=SimpleNamespace(id=uuid4()),
        settings=Settings(),
        job=_job(),
        document_type="cover_letter",
        template="ats",
    )

    assert document.generator == "deterministic-grounded"
    assert document.claim_report["unsupported_claims"] == 0