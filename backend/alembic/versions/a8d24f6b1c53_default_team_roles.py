"""default team only knows admins and auditors

Revision ID: a8d24f6b1c53
Revises: f7c13e5a9d40
Create Date: 2026-10-01 10:00:00
"""

from typing import Sequence, Union

from alembic import op

revision: str = "a8d24f6b1c53"
down_revision: Union[str, Sequence[str], None] = "f7c13e5a9d40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # early accounts landed in the default team as analyst, which is no role
    # there any more. They may still read, like an instance auditor.
    op.execute(
        "update team_memberships set role = 'audit' "
        "where role = 'analyst' "
        "and team_id in (select id from teams where name = 'Standard-Team')"
    )


def downgrade() -> None:
    pass
