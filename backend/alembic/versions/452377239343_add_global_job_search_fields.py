"""add global job search fields

Revision ID: 452377239343
Revises: 9f3b2d4a8c11
Create Date: 2026-09-20 15:23:44.491514
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "452377239343"
down_revision: Union[str, None] = "9f3b2d4a8c11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # job_postings
    # ------------------------------------------------------------------
    #
    # Existing rows already exist in the development database, so every
    # new NOT NULL column needs a server-side default during migration.
    # The SQLAlchemy model can still use its normal application defaults.

    op.add_column(
        "job_postings",
        sa.Column(
            "country",
            sa.String(length=120),
            nullable=False,
            server_default=sa.text("''"),
        ),
    )

    op.add_column(
        "job_postings",
        sa.Column(
            "country_code",
            sa.String(length=2),
            nullable=True,
        ),
    )

    op.add_column(
        "job_postings",
        sa.Column(
            "city",
            sa.String(length=160),
            nullable=True,
        ),
    )

    op.add_column(
        "job_postings",
        sa.Column(
            "category",
            sa.String(length=120),
            nullable=True,
        ),
    )

    op.add_column(
        "job_postings",
        sa.Column(
            "occupation",
            sa.String(length=180),
            nullable=True,
        ),
    )

    # Nullable is intentional. Many external providers do not tell us
    # whether sponsorship or relocation is available.
    op.add_column(
        "job_postings",
        sa.Column(
            "visa_sponsorship",
            sa.Boolean(),
            nullable=True,
        ),
    )

    op.add_column(
        "job_postings",
        sa.Column(
            "relocation_support",
            sa.Boolean(),
            nullable=True,
        ),
    )

    op.add_column(
        "job_postings",
        sa.Column(
            "work_authorization",
            sa.String(length=250),
            nullable=True,
        ),
    )

    # Indexes used by search/filter endpoints.
    op.create_index(
        "ix_job_postings_category",
        "job_postings",
        ["category"],
        unique=False,
    )

    op.create_index(
        "ix_job_postings_city",
        "job_postings",
        ["city"],
        unique=False,
    )

    op.create_index(
        "ix_job_postings_country",
        "job_postings",
        ["country"],
        unique=False,
    )

    op.create_index(
        "ix_job_postings_country_code",
        "job_postings",
        ["country_code"],
        unique=False,
    )

    op.create_index(
        "ix_job_postings_occupation",
        "job_postings",
        ["occupation"],
        unique=False,
    )

    op.create_index(
        "ix_job_postings_remote_mode",
        "job_postings",
        ["remote_mode"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # job_preferences
    # ------------------------------------------------------------------

    op.add_column(
        "job_preferences",
        sa.Column(
            "preferred_countries",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )

    op.add_column(
        "job_preferences",
        sa.Column(
            "job_categories",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )

    op.add_column(
        "job_preferences",
        sa.Column(
            "visa_sponsorship_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        "job_preferences",
        sa.Column(
            "work_authorizations",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )

    # Intentionally do NOT alter job_postings.embedding here.
    # Alembic autogenerate detected JSON -> pgvector because the runtime
    # model changes depending on whether pgvector is installed. That change
    # is unrelated to this global job-search migration and breaks SQLite.


def downgrade() -> None:
    # ------------------------------------------------------------------
    # job_preferences
    # ------------------------------------------------------------------

    op.drop_column(
        "job_preferences",
        "work_authorizations",
    )

    op.drop_column(
        "job_preferences",
        "visa_sponsorship_required",
    )

    op.drop_column(
        "job_preferences",
        "job_categories",
    )

    op.drop_column(
        "job_preferences",
        "preferred_countries",
    )

    # ------------------------------------------------------------------
    # job_postings indexes
    # ------------------------------------------------------------------

    op.drop_index(
        "ix_job_postings_remote_mode",
        table_name="job_postings",
    )

    op.drop_index(
        "ix_job_postings_occupation",
        table_name="job_postings",
    )

    op.drop_index(
        "ix_job_postings_country_code",
        table_name="job_postings",
    )

    op.drop_index(
        "ix_job_postings_country",
        table_name="job_postings",
    )

    op.drop_index(
        "ix_job_postings_city",
        table_name="job_postings",
    )

    op.drop_index(
        "ix_job_postings_category",
        table_name="job_postings",
    )

    # ------------------------------------------------------------------
    # job_postings columns
    # ------------------------------------------------------------------

    op.drop_column(
        "job_postings",
        "work_authorization",
    )

    op.drop_column(
        "job_postings",
        "relocation_support",
    )

    op.drop_column(
        "job_postings",
        "visa_sponsorship",
    )

    op.drop_column(
        "job_postings",
        "occupation",
    )

    op.drop_column(
        "job_postings",
        "category",
    )

    op.drop_column(
        "job_postings",
        "city",
    )

    op.drop_column(
        "job_postings",
        "country_code",
    )

    op.drop_column(
        "job_postings",
        "country",
    )
