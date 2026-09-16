"""add AI Resume Studio persistence

Revision ID: 9f3b2d4a8c11
Revises: bedbda4d5b1d
"""
from alembic import op
import sqlalchemy as sa

revision = "9f3b2d4a8c11"
down_revision = "bedbda4d5b1d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("uploaded_files", sa.Column("version", sa.Integer(), server_default="1", nullable=False))
    op.add_column("uploaded_files", sa.Column("processing_status", sa.String(32), server_default="queued", nullable=False))
    op.add_column("uploaded_files", sa.Column("extraction_error", sa.String(160), nullable=True))
    op.create_index("ix_uploaded_files_processing_status", "uploaded_files", ["processing_status"])
    with op.batch_alter_table("generated_documents") as batch:
        batch.add_column(sa.Column("template_key", sa.String(64), server_default="ats", nullable=False))
        batch.add_column(sa.Column("source_file_id", sa.Uuid(), nullable=True))
        batch.add_column(sa.Column("source_document_id", sa.Uuid(), nullable=True))
        batch.create_foreign_key("fk_document_source_file", "uploaded_files", ["source_file_id"], ["id"], ondelete="SET NULL")
        batch.create_foreign_key("fk_document_source_document", "generated_documents", ["source_document_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_generated_documents_source_file_id", "generated_documents", ["source_file_id"])
    op.create_table(
        "resume_suggestions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("candidate_id", sa.Uuid(), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_file_id", sa.Uuid(), sa.ForeignKey("uploaded_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("priority", sa.String(16), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("current_text", sa.Text(), server_default="", nullable=False),
        sa.Column("suggested_text", sa.Text(), server_default="", nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), server_default="pending", nullable=False),
        sa.Column("applied_document_id", sa.Uuid(), sa.ForeignKey("generated_documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_resume_suggestions_candidate_id", "resume_suggestions", ["candidate_id"])
    op.create_index("ix_resume_suggestions_source_file_id", "resume_suggestions", ["source_file_id"])
    op.create_index("ix_resume_suggestions_candidate_status", "resume_suggestions", ["candidate_id", "status"])
    op.create_table(
        "document_exports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("candidate_id", sa.Uuid(), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("generated_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("format", sa.String(8), nullable=False),
        sa.Column("template_key", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_document_exports_candidate_id", "document_exports", ["candidate_id"])
    op.create_index("ix_document_exports_document_id", "document_exports", ["document_id"])


def downgrade() -> None:
    op.drop_table("document_exports")
    op.drop_table("resume_suggestions")
    op.drop_index("ix_generated_documents_source_file_id", table_name="generated_documents")
    with op.batch_alter_table("generated_documents") as batch:
        batch.drop_constraint("fk_document_source_document", type_="foreignkey")
        batch.drop_constraint("fk_document_source_file", type_="foreignkey")
        batch.drop_column("source_document_id")
        batch.drop_column("source_file_id")
        batch.drop_column("template_key")
    op.drop_index("ix_uploaded_files_processing_status", table_name="uploaded_files")
    op.drop_column("uploaded_files", "extraction_error")
    op.drop_column("uploaded_files", "processing_status")
    op.drop_column("uploaded_files", "version")
