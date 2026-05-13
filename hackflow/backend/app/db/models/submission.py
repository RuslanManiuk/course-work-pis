from __future__ import annotations

import enum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class SubmissionStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    scored = "scored"


class RepoAccessStatus(str, enum.Enum):
    accessible = "accessible"   # public repo or private with bot access confirmed
    pending = "pending"          # private repo, access not yet verified
    access_lost = "access_lost"  # was accessible, but bot was removed


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("team_id", "hackathon_id", name="uq_team_hackathon_submission"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    team_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hackathon_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("hackathons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    repository_url: Mapped[str] = mapped_column(String(512), nullable=False)
    video_pitch_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    presentation_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[SubmissionStatus] = mapped_column(
        Enum(SubmissionStatus, create_type=False), nullable=False, default=SubmissionStatus.draft
    )
    embedding_indexed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    repo_is_private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    repo_access_status: Mapped[RepoAccessStatus] = mapped_column(
        Enum(RepoAccessStatus, name="repoaccessstatus", create_type=False),
        nullable=False,
        default=RepoAccessStatus.accessible,
    )
    submitted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    team: Mapped["Team"] = relationship(back_populates="submission")
    evaluations: Mapped[list["Evaluation"]] = relationship(back_populates="submission", lazy="select")


from app.db.models.team import Team  # noqa: E402
from app.db.models.evaluation import Evaluation  # noqa: E402
