"""add active team, rename role member to analyst

Revision ID: 4d1f6b2a8c90
Revises: 9a73fc77e039
Create Date: 2026-09-29 10:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "4d1f6b2a8c90"
down_revision: Union[str, Sequence[str], None] = "9a73fc77e039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("active_team_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_active_team_id", "users", "teams", ["active_team_id"], ["id"]
    )

    # The frontend only knows admin, analyst and audit
    op.execute("UPDATE team_memberships SET role = 'analyst' WHERE role = 'member'")


def downgrade() -> None:
    # The role stays analyst, member cannot be told apart from real analysts
    op.drop_constraint("fk_users_active_team_id", "users", type_="foreignkey")
    op.drop_column("users", "active_team_id")
