"""add team invitations

Revision ID: e6b02d4f8c39
Revises: d5a91c3e7b28
Create Date: 2026-09-30 13:30:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "e6b02d4f8c39"
down_revision: Union[str, Sequence[str], None] = "d5a91c3e7b28"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "team_invitations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column(
            "invited_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("team_id", "email"),
    )
    op.create_index("ix_team_invitations_email", "team_invitations", ["email"])


def downgrade() -> None:
    op.drop_index("ix_team_invitations_email", table_name="team_invitations")
    op.drop_table("team_invitations")
