from datetime import datetime

from sqlalchemy import JSON, Column, Text
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
    # the verdict the reporter was told last, a different decision follows as a correction
    notified_verdict: str | None = None

    raw_headers: str | None = Field(default=None, sa_column=Column(Text))

    # Progress of the analysis job. pending -> processing -> completed or failed
    step: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    # detail, step, attempt, max_attempts and at of the last failed try
    error: dict | None = Field(default=None, sa_column=Column(JSON))

    verdict: str | None = None
    # Risk score of the rules, 0 to 100. Not a confidence, the name is older
    confidence_score: float | None = None
    # name, finding and weight of each of the four checks
    criteria: list | None = Field(default=None, sa_column=Column(JSON))

    # JEV's second opinion on the text, never part of score or verdict.
    # All null when JEV gave no answer
    ai_verdict: str | None = None
    ai_confidence: float | None = None
    ai_model: str | None = None

    # Who works on the analysis, at most one person. The uploader at first,
    # null for Outlook reports until someone takes them on
    handled_by: int | None = Field(default=None, foreign_key="users.id")

    # What an analyst made of the verdict: phishing or clean. Can be taken back
    decided_verdict: str | None = None
    decided_by: int | None = Field(default=None, foreign_key="users.id")
    decided_at: datetime | None = None

    # Soft delete, the analysis stays in the database but disappears for the team
    deleted_at: datetime | None = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
