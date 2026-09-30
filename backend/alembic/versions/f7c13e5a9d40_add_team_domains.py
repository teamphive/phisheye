"""add team domains

Revision ID: f7c13e5a9d40
Revises: e6b02d4f8c39
Create Date: 2026-09-30 16:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "f7c13e5a9d40"
down_revision: Union[str, Sequence[str], None] = "e6b02d4f8c39"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "team_domains",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("added_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_team_domains_domain", "team_domains", ["domain"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_team_domains_domain", table_name="team_domains")
    op.drop_table("team_domains")
