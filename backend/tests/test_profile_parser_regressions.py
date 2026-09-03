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