"""add JEV's assessment of the mail text

Revision ID: d2b7e9f04a15
Revises: c4f8a2d61e93
Create Date: 2026-10-08 12:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "d2b7e9f04a15"
down_revision: Union[str, Sequence[str], None] = "c4f8a2d61e93"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mail_analyses", sa.Column("ai_verdict", sa.String(), nullable=True))
    op.add_column(
        "mail_analyses", sa.Column("ai_confidence", sa.Float(), nullable=True)
    )
    op.add_column("mail_analyses", sa.Column("ai_model", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("mail_analyses", "ai_model")
    op.drop_column("mail_analyses", "ai_confidence")
    op.drop_column("mail_analyses", "ai_verdict")
