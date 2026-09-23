"""add reported_by

Revision ID: c3e8a1f05d72
Revises: b7d2e4a91c3f
Create Date: 2026-09-23 21:50:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "c3e8a1f05d72"
down_revision: Union[str, Sequence[str], None] = "b7d2e4a91c3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mail_analyses",
        sa.Column("reported_by", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mail_analyses", "reported_by")
