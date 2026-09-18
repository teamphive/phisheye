"""add EML storage key

Revision ID: 8c4c7c7e9e2d
Revises: 59a8a5d0ffba
Create Date: 2026-09-18 15:45:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "8c4c7c7e9e2d"
down_revision: Union[str, Sequence[str], None] = "59a8a5d0ffba"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mail_analyses",
        sa.Column("storage_key", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mail_analyses", "storage_key")
