from datetime import datetime

from sqlmodel import Field, SQLModel


class TeamDomain(SQLModel, table=True):
    __tablename__ = "team_domains"

    id: int | None = Field(default=None, primary_key=True)

    team_id: int = Field(foreign_key="teams.id")
    # lowercase, punycode, covers its subdomains
    domain: str = Field(unique=True, index=True)
    added_by: int = Field(foreign_key="users.id")

    created_at: datetime = Field(default_factory=datetime.utcnow)
