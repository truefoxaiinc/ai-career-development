from app.core.config import Settings
from app.domains.profiles import service
from app.domains.profiles.service import _extract_entries


def test_resume_parser_rejects_known_false_positives():
    text = """
Name
Python Backend Developer
architecture.md
3. Backend working directory
Keep them in the architecture plan and implementation notes.

SKILLS
Python
FastAPI
PostgreSQL
Redis
Docker

EXPERIENCE
Python Backend Developer | Test Company | 2023 - 2025
Developed REST APIs using Python, FastAPI, PostgreSQL and Redis.

EDUCATION
Bachelor of Technology | Test University
"""

    entries = _extract_entries(text)

    labels = [
        entry["label"]
        for entry in entries
    ]

    labels_lower = [
        label.lower()
        for label in labels
    ]

    # These were previous false positives.
    assert "name" not in labels_lower
    assert "architecture.md" not in labels_lower

    assert not any(
        "backend working directory" in label.lower()
        for label in labels
    )

    assert not any(
        "keep them in the architecture" in label.lower()
        for label in labels
    )

    # Legitimate facts must still be extracted.
    assert any(
        entry["entry_type"] == "experience"
        and "Python Backend Developer" in entry["label"]
        for entry in entries
    )

    assert any(
        entry["entry_type"] == "education"
        and "Bachelor of Technology" in entry["label"]
        for entry in entries
    )

    skill_labels = [
        entry["label"]
        for entry in entries
        if entry["entry_type"] == "skill"
    ]

    assert "Python" in skill_labels
    assert "FastAPI" in skill_labels
    assert "PostgreSQL" in skill_labels
    assert "Redis" in skill_labels
    assert "Docker" in skill_labels

    # Same skill should not appear twice in one extraction.
    assert skill_labels.count("Python") == 1
    assert skill_labels.count("FastAPI") == 1


def test_resume_parser_does_not_treat_job_title_as_name():
    text = """
Senior Python Backend Developer

PROFESSIONAL SUMMARY
Backend developer experienced with Python and FastAPI.

SKILLS
Python
FastAPI

EXPERIENCE
Senior Python Backend Developer | Example Company | 2022 - 2025
"""

    entries = _extract_entries(text)

    personal_entries = [
        entry
        for entry in entries
        if entry["entry_type"] == "personal"
    ]

    assert personal_entries == []


def test_ai_resume_extraction_preserves_deterministic_experience_details(monkeypatch):
    text = """
EXPERIENCE
Senior Python Backend Developer | Example Company | 2022 - 2025
Built REST APIs using Python and FastAPI.
Reduced request latency by 40%.
"""

    class Gateway:
        configured = True

        def complete_json(self, **kwargs):
            return {
                "entries": [{
                    "entry_type": "experience",
                    "label": "Senior Python Backend Developer",
                    "source_text": "Senior Python Backend Developer | Example Company | 2022 - 2025",
                    "confidence": 0.95,
                }]
            }

    monkeypatch.setattr(service, "LiteLLMGateway", lambda settings: Gateway())

    extracted, method, reason = service._extract_entries_with_ai(
        db=None,
        user=None,
        settings=Settings(
            litellm_base_url="https://example.test",
            litellm_api_key="key",
            litellm_model="model",
        ),
        text=text,
        prompt_injection_flags=[],
    )

    labels = {entry["label"] for entry in extracted}
    assert method == "litellm-grounded"
    assert reason is None
    assert "Built REST APIs using Python and FastAPI." in labels
    assert "Reduced request latency by 40%." in labels


def test_ai_resume_extraction_preserves_grounded_experience_structure():
    from app.domains.profiles.service import _sanitize_ai_resume_entries

    resume_text = "Senior Python Backend Developer at Example Company, 2022 - 2025."
    result = _sanitize_ai_resume_entries({
        "entries": [{
            "entry_type": "experience",
            "label": "Senior Python Backend Developer",
            "source_text": resume_text,
            "structured_data": {
                "role": "Senior Python Backend Developer",
                "company": "Example Company",
                "start_date": "2022",
                "end_date": "2025",
            },
            "confidence": 0.95,
        }]
    }, resume_text)

    assert result[0]["structured_data"] == {
        "raw": resume_text,
        "role": "Senior Python Backend Developer",
        "company": "Example Company",
        "start_date": "2022",
        "end_date": "2025",
    }


def test_resume_parser_rejects_file_and_command_lines():
    text = """
resume.md
service.py
config.json
D:\\projects\\backend\\app\\main.py
python -m uvicorn app.main:app
pytest -q
docker compose up

SKILLS
Python
Docker
"""

    entries = _extract_entries(text)

    labels = [
        entry["label"].lower()
        for entry in entries
    ]

    assert "resume.md" not in labels
    assert "service.py" not in labels
    assert "config.json" not in labels

    assert not any(
        "uvicorn" in label
        for label in labels
    )

    assert not any(
        "pytest" in label
        for label in labels
    )

    assert "python" in labels
    assert "docker" in labels