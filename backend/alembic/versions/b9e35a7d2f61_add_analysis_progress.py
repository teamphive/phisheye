"""add progress and error of the analysis job

Revision ID: b9e35a7d2f61
Revises: a8d24f6b1c53
Create Date: 2026-10-02 10:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "b9e35a7d2f61"
down_revision: Union[str, Sequence[str], None] = "a8d24f6b1c53"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mail_analyses", sa.Column("step", sa.String(), nullable=True))
    op.add_column(
        "mail_analyses", sa.Column("started_at", sa.DateTime(), nullable=True)
    )
    op.add_column(
        "mail_analyses", sa.Column("completed_at", sa.DateTime(), nullable=True)
    )
    op.add_column("mail_analyses", sa.Column("error", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("mail_analyses", "error")
    op.drop_column("mail_analyses", "completed_at")
    op.drop_column("mail_analyses", "started_at")
    op.drop_column("mail_analyses", "step")
