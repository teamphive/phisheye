"""add received_at

Revision ID: b7e5c1a49d36
Revises: f3a9d6b82c47
Create Date: 2026-10-10 11:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "b7e5c1a49d36"
down_revision: Union[str, Sequence[str], None] = "f3a9d6b82c47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mail_analyses", sa.Column("received_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("mail_analyses", "received_at")
