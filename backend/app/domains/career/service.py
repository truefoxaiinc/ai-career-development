from __future__ import annotations

import uuid
from collections import Counter

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.domains.jobs.service import infer_requirements
from app.models.entities import (
    CareerGapAnalysis,
    DevelopmentRoadmap,
    JobPosting,
    ProfileEntry,
    User,
)
from app.repositories.common import candidate_for_user


def run_gap_analysis(
    db: Session,
    user: User,
    target_role: str,
    sample_size: int,
) -> CareerGapAnalysis:
    c = candidate_for_user(db, user)

    words = [
        w
        for w in target_role.lower().split()
        if len(w) > 2
    ]

    stmt = select(JobPosting).where(
        JobPosting.is_active.is_(True)
    )

    if words:
        stmt = stmt.where(
            or_(
                *[
                    func.lower(JobPosting.title).like(f"%{w}%")
                    for w in words
                ]
            )
        )

    jobs = list(
        db.scalars(
            stmt.order_by(
                JobPosting.posted_at.desc().nullslast(),
                JobPosting.created_at.desc(),
            ).limit(sample_size)
        )
    )

    counts = Counter()

    for job in jobs:
        skills = (
            job.requirements.get("skills")
            or infer_requirements(job.description).get("skills")
            or []
        )

        for skill in skills:
            counts[str(skill)] += 1

    verified = {
        entry.label.lower(): entry.label
        for entry in db.scalars(
            select(ProfileEntry).where(
                ProfileEntry.candidate_id == c.id,
                ProfileEntry.verified.is_(True),
                ProfileEntry.entry_type == "skill",
            )
        )
    }

    present = []
    missing = []

    for skill, count in counts.most_common():
        frequency_pct = round(
            100 * count / max(1, len(jobs)),
            1,
        )

        if skill.lower() in verified:
            present.append(skill)
        else:
            missing.append(
                {
                    "skill": skill,
                    "job_count": count,
                    "frequency_pct": frequency_pct,
                    "priority": (
                        "high"
                        if frequency_pct >= 50
                        else "medium"
                        if frequency_pct >= 25
                        else "lower"
                    ),
                }
            )

    recommendations = [
        {
            "skill": item["skill"],
            "priority": item["priority"],
            "why": (
                f"Requested in {item['frequency_pct']}% "
                f"of the {len(jobs)} sampled matching jobs."
            ),
            "next_step": (
                f"Build one small, evidence-producing project or work sample "
                f"using {item['skill']}, then add it to the profile only "
                "after you can verify the experience."
            ),
        }
        for item in missing[:12]
    ]

    analysis = CareerGapAnalysis(
        candidate_id=c.id,
        target_role=target_role,
        sample_size=len(jobs),
        skill_frequency=dict(counts),
        present_skills=present,
        missing_skills=missing,
        recommendations=recommendations,
    )

    db.add(analysis)
    db.commit()

    return analysis


def analysis_dict(a: CareerGapAnalysis) -> dict:
    return {
        "id": str(a.id),
        "target_role": a.target_role,
        "sample_size": a.sample_size,
        "skill_frequency": a.skill_frequency,
        "present_skills": a.present_skills,
        "missing_skills": a.missing_skills,
        "recommendations": a.recommendations,
        "created_at": a.created_at.isoformat(),
    }


def make_roadmap(
    db: Session,
    user: User,
    analysis: CareerGapAnalysis,
    months: int,
) -> DevelopmentRoadmap:
    c = candidate_for_user(db, user)

    # Use only the highest-priority missing skills.
    missing = analysis.missing_skills[:12]

    # Each missing skill is assigned exactly once.
    buckets = [[] for _ in range(months)]

    for index, item in enumerate(missing):
        buckets[index % months].append(item)

    evidence_gate = (
        "Do not mark a skill verified until you can point to a project, "
        "employment task, certification, or other source fact that supports it."
    )

    # These phases fill any months left over after all skill gaps
    # have been assigned.
    follow_up_phases = [
        {
            "focus": ["Integration project"],
            "objectives": [
                (
                    "Build a practical project combining the newly developed "
                    "skills and create reviewable evidence."
                )
            ],
        },
        {
            "focus": ["Portfolio evidence"],
            "objectives": [
                (
                    "Document completed work, technical decisions, outcomes, "
                    "and supporting evidence for the candidate profile."
                )
            ],
        },
        {
            "focus": ["Interview practice"],
            "objectives": [
                (
                    "Practice explaining the newly developed skills using "
                    "concrete, evidence-supported examples."
                )
            ],
        },
        {
            "focus": ["Gap reassessment"],
            "objectives": [
                (
                    "Run a new career-gap analysis and compare verified skills "
                    "against the target role."
                )
            ],
        },
    ]

    plan = []
    follow_up_index = 0

    for month_index in range(months):
        assigned = buckets[month_index]

        if assigned:
            focus = [
                item["skill"]
                for item in assigned
            ]

            objectives = [
                (
                    f"Learn the fundamentals of {item['skill']} and create "
                    "evidence through a practical exercise."
                )
                for item in assigned
            ]

        else:
            phase = follow_up_phases[
                min(
                    follow_up_index,
                    len(follow_up_phases) - 1,
                )
            ]

            focus = phase["focus"]
            objectives = phase["objectives"]

            follow_up_index += 1

        plan.append(
            {
                "month": month_index + 1,
                "focus": focus,
                "objectives": objectives,
                "evidence_gate": evidence_gate,
            }
        )

    roadmap = DevelopmentRoadmap(
        candidate_id=c.id,
        analysis_id=analysis.id,
        target_role=analysis.target_role,
        months=plan,
        status="active",
    )

    db.add(roadmap)
    db.commit()

    return roadmap


def roadmap_dict(r: DevelopmentRoadmap) -> dict:
    return {
        "id": str(r.id),
        "analysis_id": (
            str(r.analysis_id)
            if r.analysis_id
            else None
        ),
        "target_role": r.target_role,
        "months": r.months,
        "status": r.status,
        "created_at": r.created_at.isoformat(),
    }