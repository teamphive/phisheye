"""add decision, soft delete, raw headers and attachment size

Revision ID: 7b3e9c1d5a24
Revises: 4d1f6b2a8c90
Create Date: 2026-09-29 14:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "7b3e9c1d5a24"
down_revision: Union[str, Sequence[str], None] = "4d1f6b2a8c90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mail_analyses", sa.Column("raw_headers", sa.Text(), nullable=True))
    op.add_column(
        "mail_analyses", sa.Column("decided_verdict", sa.String(), nullable=True)
    )
    op.add_column("mail_analyses", sa.Column("decided_by", sa.Integer(), nullable=True))
    op.add_column(
        "mail_analyses", sa.Column("decided_at", sa.DateTime(), nullable=True)
    )
    op.add_column(
        "mail_analyses", sa.Column("deleted_at", sa.DateTime(), nullable=True)
    )
    op.create_foreign_key(
        "fk_mail_analyses_decided_by", "mail_analyses", "users", ["decided_by"], ["id"]
    )

    op.add_column("mail_attachments", sa.Column("size", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("mail_attachments", "size")

    op.drop_constraint(
        "fk_mail_analyses_decided_by", "mail_analyses", type_="foreignkey"
    )
    op.drop_column("mail_analyses", "deleted_at")
    op.drop_column("mail_analyses", "decided_at")
    op.drop_column("mail_analyses", "decided_by")
    op.drop_column("mail_analyses", "decided_verdict")
    op.drop_column("mail_analyses", "raw_headers")
