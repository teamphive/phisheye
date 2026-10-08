"""add the notifications of the bell

Revision ID: f3a9d6b82c47
Revises: e8c3a5f71b26
Create Date: 2026-10-08 16:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "f3a9d6b82c47"
down_revision: Union[str, Sequence[str], None] = "e8c3a5f71b26"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("tone", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("detail", sa.String(), nullable=False),
        sa.Column("target", sa.String(), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    # GET /notifications asks by person, the cleanup by age
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_notifications_created_at", "notifications")
    op.drop_index("ix_notifications_user_id", "notifications")
    op.drop_table("notifications")
