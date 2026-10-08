from datetime import datetime

from sqlmodel import Field, SQLModel


class Notification(SQLModel, table=True):
    """One entry of the bell, for one person."""

    __tablename__ = "notifications"

    id: int | None = Field(default=None, primary_key=True)

    # who sees it, the bell only ever shows one's own
    user_id: int = Field(foreign_key="users.id", index=True)

    # analysis or team, the page filters by it
    kind: str
    # phishing, suspicious, clean or info, the color of the dot
    tone: str
    title: str
    detail: str
    # path inside the app the entry leads to, e.g. /analysen/42
    target: str

    # null until the person has seen it
    read_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
