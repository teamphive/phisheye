"""add notified_verdict

Revision ID: a1d4e6b82c57
Revises: e8c3a5f71b26
Create Date: 2026-10-10 09:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a1d4e6b82c57"
down_revision: str | None = "e8c3a5f71b26"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mail_analyses", sa.Column("notified_verdict", sa.String(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("mail_analyses", "notified_verdict")
