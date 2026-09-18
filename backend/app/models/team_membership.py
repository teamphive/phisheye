from datetime import datetime

from sqlmodel import Field, SQLModel, UniqueConstraint


class TeamMembership(SQLModel, table=True):
    __tablename__ = "team_memberships"
    __table_args__ = (UniqueConstraint("team_id", "user_id"),)

    id: int | None = Field(default=None, primary_key=True)

    team_id: int = Field(foreign_key="teams.id")
    user_id: int = Field(foreign_key="users.id")
    role: str = "member"

    created_at: datetime = Field(default_factory=datetime.utcnow)
