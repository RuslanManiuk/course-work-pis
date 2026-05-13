from __future__ import annotations

import enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TicketStatus(str, enum.Enum):
    open = "open"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class TicketPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class HelpDeskTicket(Base):
    __tablename__ = "helpdesk_tickets"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    team_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hackathon_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("hackathons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    assigned_mentor_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TicketStatus] = mapped_column(Enum(TicketStatus, create_type=False), nullable=False, default=TicketStatus.open)
    priority: Mapped[TicketPriority] = mapped_column(Enum(TicketPriority, create_type=False), nullable=False, default=TicketPriority.medium)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    jitsi_room_url: Mapped[str | None] = mapped_column(String(256), nullable=True)
    session_start: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    session_end: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    team: Mapped["Team"] = relationship(back_populates="help_desk_tickets")
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
    assigned_mentor: Mapped["User | None"] = relationship(foreign_keys=[assigned_mentor_id])


from app.db.models.team import Team  # noqa: E402
from app.db.models.user import User  # noqa: E402
