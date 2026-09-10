from datetime import datetime

from sqlmodel import Field, SQLModel


class MailAttachment(SQLModel, table=True):
    __tablename__ = "mail_attachments"

    id: int | None = Field(default=None, primary_key=True)

    mail_analysis_id: int = Field(foreign_key="mail_analyses.id")

    filename: str
    sha256: str
    mime_type: str | None = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
