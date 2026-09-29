from datetime import datetime

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    keycloak_id: str | None = Field(default=None, unique=True, index=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    name: str
    totp_secret: str | None = None
    totp_enabled: bool = False
    is_operator: bool = False
    # Every team route answers for this team. Null until the user picks one
    active_team_id: int | None = Field(default=None, foreign_key="teams.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
