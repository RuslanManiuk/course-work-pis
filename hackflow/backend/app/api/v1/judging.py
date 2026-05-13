from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, get_session
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.db.models.evaluation import Evaluation, EvaluationCriteria
from app.db.models.submission import Submission
from app.db.models.team import Team
from app.db.models.user import UserRole
from app.schemas import (
    AIQueryRequest, EvaluationResponse, EvaluationSubmitRequest,
    LeaderboardEntry, LeaderboardResponse,
)
from app.services.rag_service import rag_service
from app.websocket.manager import ws_manager

router = APIRouter(tags=["Judging & AI"])


# ── Judge Dashboard ───────────────────────────────────────────────────────────

@router.get("/hackathons/{hackathon_id}/submissions")
async def list_submissions_for_judging(
    hackathon_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    if current_user.role not in (UserRole.judge, UserRole.organizer):
        raise ForbiddenError()

    result = await session.scalars(
        select(Submission).where(Submission.hackathon_id == hackathon_id)
    )
    submissions = result.all()

    items = []
    for sub in submissions:
        judge_count = await session.scalar(
            select(func.count()).where(
                Evaluation.submission_id == sub.id,
                Evaluation.judge_id == current_user.id,
            )
        )
        team = await session.get(Team, sub.team_id)
        items.append({
            "submission_id": str(sub.id),
            "team_id": str(sub.team_id),
            "team_name": team.name if team else None,
            "status": sub.status,
            "embedding_indexed": sub.embedding_indexed,
            "scored_by_me": (judge_count or 0) > 0,
            "repository_url": sub.repository_url,
            "video_pitch_url": sub.video_pitch_url,
            "presentation_url": sub.presentation_url,
            "description": sub.description,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
        })
    return items


@router.post("/submissions/{submission_id}/evaluate", response_model=list[EvaluationResponse])
async def submit_evaluation(
    submission_id: UUID,
    body: EvaluationSubmitRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != UserRole.judge:
        raise ForbiddenError("Only judges can evaluate submissions")

    sub = await session.get(Submission, submission_id)
    if not sub:
        raise NotFoundError("Submission", str(submission_id))

    created = []
    for item in body.evaluations:
        # Validate criteria belongs to the hackathon
        criteria = await session.get(EvaluationCriteria, item.criteria_id)
        if not criteria or criteria.hackathon_id != sub.hackathon_id:
            raise NotFoundError("Criteria", str(item.criteria_id))

        # Check for duplicate (UNIQUE constraint handles DB-level, but we give nice error)
        existing = await session.scalar(
            select(Evaluation).where(
                Evaluation.submission_id == submission_id,
                Evaluation.judge_id == current_user.id,
                Evaluation.criteria_id == item.criteria_id,
            )
        )
        if existing:
            existing.score = item.score
            existing.feedback = item.feedback
            created.append(existing)
        else:
            evaluation = Evaluation(
                submission_id=submission_id,
                judge_id=current_user.id,
                criteria_id=item.criteria_id,
                score=item.score,
                feedback=item.feedback,
            )
            session.add(evaluation)
            created.append(evaluation)

    await session.commit()
    for e in created:
        await session.refresh(e)

    # Recalculate team avg_score
    await _recalculate_score(submission_id, sub.hackathon_id, sub.team_id, session)

    return created


async def _recalculate_score(
    submission_id: UUID, hackathon_id: UUID, team_id: UUID, session: AsyncSession
) -> None:
    criteria = (
        await session.scalars(
            select(EvaluationCriteria).where(EvaluationCriteria.hackathon_id == hackathon_id)
        )
    ).all()

    if not criteria:
        return

    total_weight = sum(c.weight for c in criteria)
    weighted_sum = 0.0
    judge_scores: dict[UUID, dict[UUID, int]] = {}

    evaluations = (
        await session.scalars(select(Evaluation).where(Evaluation.submission_id == submission_id))
    ).all()

    for ev in evaluations:
        judge_scores.setdefault(ev.judge_id, {})[ev.criteria_id] = ev.score

    if not judge_scores:
        return

    total_score = 0.0
    for judge_evals in judge_scores.values():
        for c in criteria:
            score = judge_evals.get(c.id, 0)
            total_score += score * c.weight

    avg = total_score / (total_weight * len(judge_scores))

    team = await session.get(Team, team_id)
    if team:
        team.avg_score = round(avg, 2)
    await session.commit()

    await ws_manager.broadcast(
        f"hackathon:{hackathon_id}",
        "leaderboard:updated",
        {"team_id": str(team_id), "avg_score": avg},
    )


@router.get("/hackathons/{hackathon_id}/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    hackathon_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    teams = (
        await session.scalars(
            select(Team)
            .where(Team.hackathon_id == hackathon_id)
            .order_by(Team.avg_score.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).all()

    total = await session.scalar(
        select(func.count()).where(Team.hackathon_id == hackathon_id)
    )

    entries = []
    for rank, team in enumerate(teams, start=(page - 1) * limit + 1):
        await session.refresh(team, ["submission"])
        entries.append(
            LeaderboardEntry(
                rank=rank,
                team_id=team.id,
                team_name=team.name,
                avg_score=team.avg_score,
                submission_id=team.submission.id if team.submission else None,
            )
        )

    return LeaderboardResponse(hackathon_id=hackathon_id, entries=entries, total=total or 0)


# ── AI Assistant ──────────────────────────────────────────────────────────────

@router.post("/ai-assistant/query")
async def ai_query(body: AIQueryRequest, current_user: CurrentUser):
    if current_user.role not in (UserRole.judge, UserRole.organizer):
        raise ForbiddenError("Only judges and organizers can use the AI assistant")

    async def _stream():
        async for chunk in rag_service.query(body.hackathon_id, body.question):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


@router.post("/submissions/{submission_id}/ai-evaluate")
async def ai_evaluate_submission(
    submission_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Use Gemini AI to auto-score a submission against the hackathon criteria."""
    if current_user.role not in (UserRole.judge, UserRole.organizer):
        raise ForbiddenError("Only judges and organizers can use AI evaluation")

    sub = await session.get(Submission, submission_id)
    if not sub:
        raise NotFoundError("Submission", str(submission_id))

    team = await session.get(Team, sub.team_id)
    team_name = team.name if team else "Unknown Team"

    criteria_rows = (
        await session.scalars(
            select(EvaluationCriteria)
            .where(EvaluationCriteria.hackathon_id == sub.hackathon_id)
            .order_by(EvaluationCriteria.order)
        )
    ).all()

    if not criteria_rows:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No evaluation criteria defined for this hackathon")

    criteria_list = [
        {"id": str(c.id), "name": c.name, "max_score": c.max_score}
        for c in criteria_rows
    ]

    try:
        scores = await rag_service.evaluate_submission(
            submission_title=team_name,
            submission_description=sub.description or "",
            repository_url=sub.repository_url or "",
            criteria=criteria_list,
        )
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=f"AI evaluation failed: {exc}") from exc

    return {"scores": scores}


@router.post("/submissions/{submission_id}/ai-summary")
async def ai_summarize_submission(
    submission_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Generate a short AI summary of a submission for judges."""
    if current_user.role not in (UserRole.judge, UserRole.organizer):
        raise ForbiddenError("Only judges and organizers can use AI summary")

    sub = await session.get(Submission, submission_id)
    if not sub:
        raise NotFoundError("Submission", str(submission_id))

    team = await session.get(Team, sub.team_id)
    team_name = team.name if team else "Unknown Team"

    from app.services.rag_service import _chat
    prompt = f"""You are a hackathon judge reviewing a project submission.
Write a single concise sentence (max 25 words) that captures what this project does and its key innovation.

Team: {team_name}
Description: {sub.description or "(no description provided)"}
Repository: {sub.repository_url or "(no repository)"}

Output only the one-sentence summary, nothing else."""

    try:
        summary = await _chat([{"role": "user", "content": prompt}])
        return {"summary": summary.strip()}
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=f"AI summary failed: {exc}") from exc
