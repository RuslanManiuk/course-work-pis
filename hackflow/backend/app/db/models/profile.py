from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    # [{"name": "Python", "proficiency": "advanced"}, ...]
    skills: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    # [{"tech": "React", "years": 2}, ...]
    tech_stack: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    years_experience: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Mentor-specific: [{"area": "ML", "level": "expert"}]
    mentoring_expertise: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="profile")


from app.db.models.user import User  # noqa: E402
