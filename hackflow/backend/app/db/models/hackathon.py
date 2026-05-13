from __future__ import annotations

import enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class HackathonStatus(str, enum.Enum):
    draft = "draft"
    upcoming = "upcoming"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class Hackathon(Base):
    __tablename__ = "hackathons"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    organizer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[HackathonStatus] = mapped_column(
        Enum(HackathonStatus, create_type=False), nullable=False, default=HackathonStatus.draft, index=True
    )
    start_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    submission_deadline: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    registration_deadline: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    max_team_size: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    min_team_size: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    max_participants: Mapped[int | None] = mapped_column(Integer, nullable=True)
    discord_server_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # [{"name": "AI", "color": "#FF6B6B"}, ...]
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    teams: Mapped[list["Team"]] = relationship(back_populates="hackathon", lazy="select")
    criteria: Mapped[list["EvaluationCriteria"]] = relationship(back_populates="hackathon", lazy="select")


from app.db.models.team import Team  # noqa: E402
from app.db.models.evaluation import EvaluationCriteria  # noqa: E402
