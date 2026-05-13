from __future__ import annotations

import enum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TeamStatus(str, enum.Enum):
    forming = "forming"
    active = "active"
    submitted = "submitted"
    eliminated = "eliminated"
    won = "won"


class TeamMemberRole(str, enum.Enum):
    leader = "leader"
    member = "member"


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    hackathon_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("hackathons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TeamStatus] = mapped_column(Enum(TeamStatus, create_type=False), nullable=False, default=TeamStatus.forming)
    leader_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False
    )
    size: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    invite_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    invite_token_expires_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    discord_text_channel_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    discord_voice_channel_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    avg_score: Mapped[float] = mapped_column(nullable=False, default=0.0)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    hackathon: Mapped["Hackathon"] = relationship(back_populates="teams")
    members: Mapped[list["TeamMember"]] = relationship(back_populates="team", lazy="select", cascade="all, delete-orphan")
    submission: Mapped["Submission | None"] = relationship(back_populates="team", uselist=False, lazy="select")
    discord_integration: Mapped["DiscordIntegration | None"] = relationship(
        back_populates="team", uselist=False, lazy="select"
    )
    kanban_cards: Mapped[list["KanbanCard"]] = relationship(
        back_populates="team", lazy="select", cascade="all, delete-orphan"
    )
    help_desk_tickets: Mapped[list["HelpDeskTicket"]] = relationship(back_populates="team", lazy="select")


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_member"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    team_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[TeamMemberRole] = mapped_column(
        Enum(TeamMemberRole, create_type=False), nullable=False, default=TeamMemberRole.member
    )
    joined_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    team: Mapped["Team"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="team_memberships", lazy="selectin")

    @property
    def username(self) -> str:
        return self.user.username

    @property
    def avatar_url(self):
        return self.user.avatar_url


from app.db.models.hackathon import Hackathon  # noqa: E402
from app.db.models.user import User  # noqa: E402
from app.db.models.submission import Submission  # noqa: E402
from app.db.models.discord_integration import DiscordIntegration  # noqa: E402
from app.db.models.kanban import KanbanCard  # noqa: E402
from app.db.models.helpdesk import HelpDeskTicket  # noqa: E402
