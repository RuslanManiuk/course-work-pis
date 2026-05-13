from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class HackathonWinner(Base):
    __tablename__ = "hackathon_winners"
    __table_args__ = (
        UniqueConstraint("hackathon_id", "rank", name="uq_winner_hackathon_rank"),
        UniqueConstraint("hackathon_id", "team_id", name="uq_winner_hackathon_team"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    hackathon_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("hackathons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rank: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 = winner, 2 = runner-up, ...
    prize: Mapped[str | None] = mapped_column(String(256), nullable=True)
    note: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    hackathon: Mapped["Hackathon"] = relationship()
    team: Mapped["Team"] = relationship()


from app.db.models.hackathon import Hackathon  # noqa: E402
from app.db.models.team import Team  # noqa: E402
