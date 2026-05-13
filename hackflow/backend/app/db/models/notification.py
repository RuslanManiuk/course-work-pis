from __future__ import annotations

import enum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class NotificationType(str, enum.Enum):
    team_invite = "team_invite"
    mentor_assigned = "mentor_assigned"
    score_update = "score_update"
    event_reminder = "event_reminder"
    submission_accepted = "submission_accepted"
    broadcast = "broadcast"


class NotificationPriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hackathon_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("hackathons.id", ondelete="SET NULL"), nullable=True
    )
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType, create_type=False), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    related_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    priority: Mapped[NotificationPriority] = mapped_column(
        Enum(NotificationPriority, create_type=False), nullable=False, default=NotificationPriority.normal
    )
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    email_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    user: Mapped["User"] = relationship()


from app.db.models.user import User  # noqa: E402
