from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import JSON, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GithubStats(Base):
    __tablename__ = "github_stats"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    repositories: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    followers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_contributions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # [{"language": "Python", "percentage": 45.3}, ...]
    language_breakdown: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    cached_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="github_stats")


from app.db.models.user import User  # noqa: E402
