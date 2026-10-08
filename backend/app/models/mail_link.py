from datetime import datetime

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class MailLink(SQLModel, table=True):
    __tablename__ = "mail_links"

    id: int | None = Field(default=None, primary_key=True)

    mail_analysis_id: int = Field(foreign_key="mail_analyses.id")

    # What the reader sees and where the link really goes
    text: str = Field(sa_column=Column(Text, nullable=False))
    target: str = Field(sa_column=Column(Text, nullable=False))
    # Own column so the search can find analyses by link domain
    host: str
    finding: str
    # clean, suspicious or phishing, the color of the badge
    tone: str

    created_at: datetime = Field(default_factory=datetime.utcnow)
