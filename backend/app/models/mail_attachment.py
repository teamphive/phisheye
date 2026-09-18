from datetime import datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class MailAttachment(SQLModel, table=True):
    __tablename__ = "mail_attachments"

    id: int | None = Field(default=None, primary_key=True)

    mail_analysis_id: int = Field(foreign_key="mail_analyses.id")

    filename: str
    sha256: str
    mime_type: str | None = None
    vt_results: dict | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )

    created_at: datetime = Field(default_factory=datetime.utcnow)
