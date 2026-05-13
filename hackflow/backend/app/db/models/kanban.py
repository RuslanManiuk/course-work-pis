from __future__ import annotations

import enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CardStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class KanbanCard(Base):
    __tablename__ = "kanban_cards"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    team_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    assigned_to_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CardStatus] = mapped_column(Enum(CardStatus, create_type=False), nullable=False, default=CardStatus.todo)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=2)  # 1-5
    # Color-coded label: "feature" | "bug" | "design" | "docs" | "ops" | "research" | None
    label: Mapped[str | None] = mapped_column(String(32), nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    due_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    team: Mapped["Team"] = relationship(back_populates="kanban_cards")
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
    assigned_to: Mapped["User | None"] = relationship(foreign_keys=[assigned_to_id])


from app.db.models.team import Team  # noqa: E402
from app.db.models.user import User  # noqa: E402
