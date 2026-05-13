from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EvaluationCriteria(Base):
    __tablename__ = "evaluation_criteria"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    hackathon_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("hackathons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    hackathon: Mapped["Hackathon"] = relationship(back_populates="criteria")
    evaluations: Mapped[list["Evaluation"]] = relationship(back_populates="criteria", lazy="select")


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (UniqueConstraint("submission_id", "judge_id", "criteria_id", name="uq_judge_submission_criteria"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    submission_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    judge_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    criteria_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("evaluation_criteria.id", ondelete="CASCADE"), nullable=False
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-10
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    submission: Mapped["Submission"] = relationship(back_populates="evaluations")
    judge: Mapped["User"] = relationship()
    criteria: Mapped["EvaluationCriteria"] = relationship(back_populates="evaluations")


from app.db.models.hackathon import Hackathon  # noqa: E402
from app.db.models.submission import Submission  # noqa: E402
from app.db.models.user import User  # noqa: E402
