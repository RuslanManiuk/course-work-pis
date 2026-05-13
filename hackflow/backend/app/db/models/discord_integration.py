from __future__ import annotations

import enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SyncStatus(str, enum.Enum):
    pending = "pending"
    synced = "synced"
    failed = "failed"


class DiscordIntegration(Base):
    __tablename__ = "discord_integrations"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    team_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    discord_guild_id: Mapped[str] = mapped_column(String(32), nullable=False)
    text_channel_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    voice_channel_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sync_status: Mapped[SyncStatus] = mapped_column(Enum(SyncStatus, create_type=False), nullable=False, default=SyncStatus.pending)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_sync: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    team: Mapped["Team"] = relationship(back_populates="discord_integration")


from app.db.models.team import Team  # noqa: E402
