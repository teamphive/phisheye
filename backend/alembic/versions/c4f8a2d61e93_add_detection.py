"""add criteria and links of the detection

Revision ID: c4f8a2d61e93
Revises: b9e35a7d2f61
Create Date: 2026-10-08 10:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "c4f8a2d61e93"
down_revision: Union[str, Sequence[str], None] = "b9e35a7d2f61"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mail_analyses", sa.Column("criteria", sa.JSON(), nullable=True))
    op.create_table(
        "mail_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "mail_analysis_id",
            sa.Integer(),
            sa.ForeignKey("mail_analyses.id"),
            nullable=False,
        ),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("target", sa.Text(), nullable=False),
        sa.Column("host", sa.String(), nullable=False),
        sa.Column("finding", sa.String(), nullable=False),
        sa.Column("tone", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("mail_links")
    op.drop_column("mail_analyses", "criteria")
