from datetime import datetime

from sqlmodel import Field, SQLModel, UniqueConstraint


class TeamInvitation(SQLModel, table=True):
    __tablename__ = "team_invitations"
    __table_args__ = (UniqueConstraint("team_id", "email"),)

    id: int | None = Field(default=None, primary_key=True)

    team_id: int = Field(foreign_key="teams.id")
    # lowercase, matches the email of the account at the first request
    email: str = Field(index=True)
    # admin, analyst or audit, applies once the person signs in
    role: str = "analyst"
    invited_by: int = Field(foreign_key="users.id")

    created_at: datetime = Field(default_factory=datetime.utcnow)
