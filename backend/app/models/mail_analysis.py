from datetime import datetime

from sqlalchemy import Column, Text
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
    reported_by: str | None = None
    notified_at: datetime | None = None

    raw_headers: str | None = Field(default=None, sa_column=Column(Text))

    verdict: str | None = None
    confidence_score: float | None = None

    # What an analyst made of the verdict: phishing or clean. Can be taken back
    decided_verdict: str | None = None
    decided_by: int | None = Field(default=None, foreign_key="users.id")
    decided_at: datetime | None = None

    # Soft delete, the analysis stays in the database but disappears for the team
    deleted_at: datetime | None = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
