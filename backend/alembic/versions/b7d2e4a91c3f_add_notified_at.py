"""add notified_at

Revision ID: b7d2e4a91c3f
Revises: 8c4c7c7e9e2d
Create Date: 2026-09-23 21:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "b7d2e4a91c3f"
down_revision: Union[str, Sequence[str], None] = "8c4c7c7e9e2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mail_analyses",
        sa.Column("notified_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mail_analyses", "notified_at")
