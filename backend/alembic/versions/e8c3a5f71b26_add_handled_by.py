"""add the person an analysis is assigned to

Revision ID: e8c3a5f71b26
Revises: d2b7e9f04a15
Create Date: 2026-10-08 14:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "e8c3a5f71b26"
down_revision: Union[str, Sequence[str], None] = "d2b7e9f04a15"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mail_analyses", sa.Column("handled_by", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_mail_analyses_handled_by", "mail_analyses", "users", ["handled_by"], ["id"]
    )

    # Existing analyses get who would have had them: an upload its uploader,
    # then a decided one without that the person who decided. Reports stay
    # empty. Their submitted_by is the system user, and reports from the
    # Mailgun webhook have no reported_by either, so the system user is
    # excluded by its address
    op.execute(
        "UPDATE mail_analyses SET handled_by = submitted_by"
        " WHERE reported_by IS NULL AND submitted_by NOT IN"
        " (SELECT id FROM users WHERE email = 'system@phisheye.internal')"
    )
    op.execute(
        "UPDATE mail_analyses SET handled_by = decided_by"
        " WHERE handled_by IS NULL AND decided_by IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_mail_analyses_handled_by", "mail_analyses", type_="foreignkey"
    )
    op.drop_column("mail_analyses", "handled_by")
