from __future__ import annotations

from datetime import UTC, datetime
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.domains.jobs.service import refresh_from_configured_providers
from app.models.entities import Candidate, ProfileEntry, User


def seed():
    settings = get_settings()
    if settings.environment not in {"development", "test"}:
        raise SystemExit("Seed data is development/test-only")
    db = SessionLocal()
    try:
        demo = db.scalar(select(User).where(User.email == "demo@careerpilot.dev"))
        if not demo:
            demo = User(email="demo@careerpilot.dev", password_hash=hash_password("CareerPilot123!"), is_email_verified=True, role="candidate")
            db.add(demo); db.flush()
            candidate = Candidate(user_id=demo.id, name="Maya Rao", headline="Senior Product Engineer", location="Bengaluru, India", profile_summary="Product engineer focused on frontend platforms, performance and accessible user experiences.")
            db.add(candidate); db.flush()
            facts = [
                ("skill", "TypeScript", "TypeScript used in production product and platform work."),
                ("skill", "React", "React used in production product and platform work."),
                ("skill", "Next.js", "Next.js used in product delivery."),
                ("skill", "Accessibility", "Implemented accessible shared UI primitives."),
                ("skill", "PostgreSQL", "Used PostgreSQL in product systems."),
                ("experience", "Clearline · Senior Product Engineer · 2023-present", "Senior Product Engineer at Clearline since 2023."),
                ("achievement", "Reduced checkout p95 latency by 34%", "Cut checkout p95 from 1.8s to 1.19s after redesigning cache behavior."),
                ("project", "UI Platform Migration", "Migrated 38 product surfaces onto a shared React component platform."),
                ("education", "B.Tech · Computer Science · PES University", "B.Tech in Computer Science, PES University, 2014-2018."),
            ]
            for entry_type, label, source in facts:
                db.add(ProfileEntry(candidate_id=candidate.id, entry_type=entry_type, label=label, structured_data={"raw": source}, source_text=source, verified=True, confidence=1.0, verification_note="Development seed fact", verified_at=datetime.now(UTC)))
        admin = db.scalar(select(User).where(User.email == "admin@careerpilot.dev"))
        if not admin:
            admin = User(email="admin@careerpilot.dev", password_hash=hash_password("CareerPilotAdmin123!"), is_email_verified=True, role="admin")
            db.add(admin); db.flush(); db.add(Candidate(user_id=admin.id, name="CareerPilot Admin"))
        db.commit()
        summary = refresh_from_configured_providers(db, settings, query="", location="", limit_per_provider=20)
        print({"seeded": True, "jobs": summary.get("ingested", 0), "demo_email": "demo@careerpilot.dev", "admin_email": "admin@careerpilot.dev"})
    finally:
        db.close()


if __name__ == "__main__":
    seed()
