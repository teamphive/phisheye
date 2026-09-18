from datetime import datetime

from sqlmodel import Field, SQLModel


class MailAnalysis(SQLModel, table=True):
    __tablename__ = "mail_analyses"

    id: int | None = Field(default=None, primary_key=True)

    team_id: int = Field(foreign_key="teams.id")
    submitted_by: int = Field(foreign_key="users.id")

    subject: str
    sender: str
    status: str = "pending"
    storage_key: str | None = None

    verdict: str | None = None
    confidence_score: float | None = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
