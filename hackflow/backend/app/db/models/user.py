from __future__ import annotations

import enum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    hacker = "hacker"
    mentor = "mentor"
    judge = "judge"
    organizer = "organizer"


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, create_type=False), nullable=False, default=UserRole.hacker)
    github_id: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True, index=True)
    github_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    profile: Mapped["UserProfile | None"] = relationship(back_populates="user", uselist=False, lazy="select")
    team_memberships: Mapped[list["TeamMember"]] = relationship(back_populates="user", lazy="select")
    github_stats: Mapped["GithubStats | None"] = relationship(back_populates="user", uselist=False, lazy="select")


# Avoid circular import — import models here after User is defined
from app.db.models.profile import UserProfile  # noqa: E402
from app.db.models.team import TeamMember  # noqa: E402
from app.db.models.github_stats import GithubStats  # noqa: E402
