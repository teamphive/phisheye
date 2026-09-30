"""add team soft delete

Revision ID: d5a91c3e7b28
Revises: 7b3e9c1d5a24
Create Date: 2026-09-30 10:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "d5a91c3e7b28"
down_revision: Union[str, Sequence[str], None] = "7b3e9c1d5a24"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("deleted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("teams", "deleted_at")
