from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, get_session
from app.core.exceptions import ConflictError, DeadlinePassedError, ForbiddenError, NotFoundError, ValidationError
from app.db.models.kanban import KanbanCard, CardStatus
from app.db.models.submission import Submission, SubmissionStatus, RepoAccessStatus
from app.db.models.team import Team, TeamMember
from app.schemas import (
    KanbanCardCreateRequest, KanbanCardReorderRequest, KanbanCardResponse,
    KanbanCardUpdateRequest, SubmissionCreateRequest, SubmissionResponse, SubmissionUpdateRequest,
)
from app.websocket.manager import ws_manager

router = APIRouter(tags=["Workspace"])


async def _get_team_or_403(team_id: UUID, user_id: UUID, session: AsyncSession) -> Team:
    team = await session.get(Team, team_id)
    if not team:
        raise NotFoundError("Team", str(team_id))
    member = await session.scalar(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
    )
    if not member:
        raise ForbiddenError("You are not a member of this team")
    return team


# ── Kanban ────────────────────────────────────────────────────────────────────

@router.get("/teams/{team_id}/workspace")
async def get_workspace(
    team_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    await _get_team_or_403(team_id, current_user.id, session)

    cards = (
        await session.scalars(
            select(KanbanCard).where(KanbanCard.team_id == team_id).order_by(KanbanCard.status, KanbanCard.order)
        )
    ).all()

    board = {
        "todo": [c for c in cards if c.status == CardStatus.todo],
        "in_progress": [c for c in cards if c.status == CardStatus.in_progress],
        "done": [c for c in cards if c.status == CardStatus.done],
    }
    return {"board": board}


@router.post("/teams/{team_id}/kanban/cards", response_model=KanbanCardResponse, status_code=201)
async def create_card(
    team_id: UUID,
    body: KanbanCardCreateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    await _get_team_or_403(team_id, current_user.id, session)

    max_order_row = await session.scalar(
        select(KanbanCard.order)
        .where(KanbanCard.team_id == team_id, KanbanCard.status == CardStatus.todo)
        .order_by(KanbanCard.order.desc())
        .limit(1)
    )
    card = KanbanCard(
        team_id=team_id,
        created_by_id=current_user.id,
        order=(max_order_row or 0) + 1,
        **body.model_dump(),
    )
    session.add(card)
    await session.commit()
    await session.refresh(card)

    await ws_manager.broadcast(
        f"team:{team_id}", "kanban:card-created", {"card_id": str(card.id), "title": card.title}
    )
    return card


@router.put("/teams/{team_id}/kanban/cards/{card_id}", response_model=KanbanCardResponse)
async def update_card(
    team_id: UUID,
    card_id: UUID,
    body: KanbanCardUpdateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    await _get_team_or_403(team_id, current_user.id, session)

    card = await session.get(KanbanCard, card_id)
    if not card or card.team_id != team_id:
        raise NotFoundError("Card", str(card_id))

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(card, field, value)
    await session.commit()
    await session.refresh(card)

    await ws_manager.broadcast(
        f"team:{team_id}", "kanban:card-updated", {"card_id": str(card.id), "status": card.status}
    )
    return card


@router.delete("/teams/{team_id}/kanban/cards/{card_id}")
async def delete_card(
    team_id: UUID,
    card_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    await _get_team_or_403(team_id, current_user.id, session)

    card = await session.get(KanbanCard, card_id)
    if not card or card.team_id != team_id:
        raise NotFoundError("Card", str(card_id))

    await session.delete(card)
    await session.commit()

    await ws_manager.broadcast(f"team:{team_id}", "kanban:card-deleted", {"card_id": str(card_id)})
    return {"deleted": True}


@router.patch("/teams/{team_id}/kanban/cards/reorder")
async def reorder_cards(
    team_id: UUID,
    body: KanbanCardReorderRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    await _get_team_or_403(team_id, current_user.id, session)

    for item in body.cards:
        card = await session.get(KanbanCard, item.id)
        if card and card.team_id == team_id:
            card.status = item.status  # type: ignore[assignment]
            card.order = item.order
    await session.commit()
    return {"reordered": True}


# ── Submissions ───────────────────────────────────────────────────────────────

@router.post("/teams/{team_id}/submissions", response_model=SubmissionResponse, status_code=201)
async def create_submission(
    team_id: UUID,
    body: SubmissionCreateRequest,
    background: BackgroundTasks,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    from datetime import datetime, timezone

    team = await _get_team_or_403(team_id, current_user.id, session)
    await session.refresh(team, ["submission"])

    from app.db.models.hackathon import Hackathon

    hackathon = await session.get(Hackathon, team.hackathon_id)
    now = datetime.now(timezone.utc)
    if hackathon and hackathon.submission_deadline.replace(tzinfo=timezone.utc) < now:
        raise DeadlinePassedError("Submission deadline has passed")

    if team.submission:
        raise ConflictError("Team already has a submission — use PUT to update it")

    # ── Private repo access check ────────────────────────────────────────────
    access_status = RepoAccessStatus.accessible
    if body.repo_is_private:
        from app.services.github_service import github_service
        try:
            has_access = await github_service.check_repo_access(body.repository_url)
        except ValueError as exc:
            raise ValidationError(str(exc))
        if not has_access:
            access_status = RepoAccessStatus.pending
            # Return helpful error immediately so the user knows what to do
            from app.core.config import get_settings as _get
            bot_username = _get().github_bot_username if hasattr(_get(), "github_bot_username") else "hackflow-bot"
            raise ValidationError(
                f"Access denied. Please add @{bot_username} as a collaborator with 'Read' access "
                f"to your private repository, then click 'Retry'."
            )
        access_status = RepoAccessStatus.accessible

    submission = Submission(
        team_id=team_id,
        hackathon_id=team.hackathon_id,
        status=SubmissionStatus.submitted,
        submitted_at=now,
        repo_is_private=body.repo_is_private,
        repo_access_status=access_status,
        **{k: v for k, v in body.model_dump().items() if k != "repo_is_private"},
    )
    session.add(submission)
    await session.commit()
    await session.refresh(submission)

    # Trigger RAG indexing
    background.add_task(
        _index_submission_rag,
        submission.id,
        team.hackathon_id,
        team_id,
    )

    await ws_manager.broadcast(
        f"hackathon:{team.hackathon_id}",
        "submission:received",
        {"team_id": str(team_id), "submission_id": str(submission.id)},
    )
    return submission


@router.get("/teams/{team_id}/submissions", response_model=SubmissionResponse)
async def get_team_submission(
    team_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    await _get_team_or_403(team_id, current_user.id, session)

    sub = await session.scalar(select(Submission).where(Submission.team_id == team_id))
    if not sub:
        raise NotFoundError("Submission", str(team_id))
    return sub


@router.get("/teams/{team_id}/submissions/repo-stats")
async def get_repo_stats(
    team_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Return live GitHub stats for the team's submitted repository."""
    await _get_team_or_403(team_id, current_user.id, session)

    sub = await session.scalar(select(Submission).where(Submission.team_id == team_id))
    if not sub:
        raise NotFoundError("Submission", str(team_id))

    from app.services.github_service import github_service
    try:
        stats = await github_service.fetch_repo_stats(sub.repository_url)
    except ValueError as exc:
        raise ValidationError(str(exc))

    return stats


async def _index_submission_rag(submission_id: UUID, hackathon_id: UUID, team_id: UUID) -> None:
    from app.db.base import AsyncSessionLocal
    from app.db.models.team import Team
    from app.db.models.user import User
    from app.db.models.submission import Submission
    from app.services.rag_service import rag_service

    async with AsyncSessionLocal() as session:
        sub = await session.get(Submission, submission_id)
        team = await session.get(Team, team_id)
        if not sub or not team:
            return

        skills: list[str] = []
        await session.refresh(team, ["members"])
        for member in team.members:
            user = await session.get(User, member.user_id)
            if user:
                await session.refresh(user, ["profile"])
                if user.profile and user.profile.skills:
                    skills.extend(s["name"] for s in user.profile.skills if isinstance(s, dict))

        try:
            await rag_service.index_submission(
                submission_id=sub.id,
                hackathon_id=hackathon_id,
                team_name=team.name,
                description=sub.description,
                repository_url=sub.repository_url,
                skills=skills,
            )
            sub.embedding_indexed = True
            await session.commit()
        except Exception:
            pass  # Non-critical — submission is already saved


@router.put("/teams/{team_id}/submissions/{submission_id}", response_model=SubmissionResponse)
async def update_submission(
    team_id: UUID,
    submission_id: UUID,
    body: SubmissionUpdateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    await _get_team_or_403(team_id, current_user.id, session)

    sub = await session.get(Submission, submission_id)
    if not sub or sub.team_id != team_id:
        raise NotFoundError("Submission", str(submission_id))

    update_data = body.model_dump(exclude_none=True)

    # Re-check access when repo URL or privacy flag changes
    new_url = update_data.get("repository_url", sub.repository_url)
    new_is_private = update_data.get("repo_is_private", sub.repo_is_private)
    url_changed = "repository_url" in update_data and update_data["repository_url"] != sub.repository_url
    privacy_changed = "repo_is_private" in update_data

    if new_is_private and (url_changed or privacy_changed):
        from app.services.github_service import github_service
        try:
            has_access = await github_service.check_repo_access(new_url)
        except ValueError as exc:
            raise ValidationError(str(exc))
        update_data["repo_access_status"] = (
            RepoAccessStatus.accessible if has_access else RepoAccessStatus.pending
        )
        if not has_access:
            from app.core.config import get_settings as _get
            bot_username = "hackflow-bot"
            raise ValidationError(
                f"Access denied. Please add @{bot_username} as a collaborator with 'Read' access "
                f"to your private repository, then click 'Retry'."
            )
    elif not new_is_private:
        update_data["repo_access_status"] = RepoAccessStatus.accessible

    for field, value in update_data.items():
        setattr(sub, field, value)
    await session.commit()
    await session.refresh(sub)
    return sub


@router.get("/submissions/{submission_id}", response_model=SubmissionResponse)
async def get_submission(
    submission_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    sub = await session.get(Submission, submission_id)
    if not sub:
        raise NotFoundError("Submission", str(submission_id))
    from app.db.models.user import UserRole
    if current_user.role not in (UserRole.judge, UserRole.organizer):
        member = await session.scalar(
            select(TeamMember).where(
                TeamMember.team_id == sub.team_id,
                TeamMember.user_id == current_user.id,
            )
        )
        if not member:
            raise ForbiddenError("Access denied")
    return sub


@router.post("/teams/{team_id}/submissions/{submission_id}/verify-access", response_model=SubmissionResponse)
async def verify_repo_access(
    team_id: UUID,
    submission_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Re-check bot collaborator access for a private repository."""
    await _get_team_or_403(team_id, current_user.id, session)

    sub = await session.get(Submission, submission_id)
    if not sub or sub.team_id != team_id:
        raise NotFoundError("Submission", str(submission_id))

    if not sub.repo_is_private:
        return sub  # nothing to verify for public repos

    from app.services.github_service import github_service
    try:
        has_access = await github_service.check_repo_access(sub.repository_url)
    except ValueError as exc:
        raise ValidationError(str(exc))

    if has_access:
        sub.repo_access_status = RepoAccessStatus.accessible
    else:
        # If it was accessible before and now isn't, mark as access_lost
        sub.repo_access_status = (
            RepoAccessStatus.access_lost
            if sub.repo_access_status == RepoAccessStatus.accessible
            else RepoAccessStatus.pending
        )

    await session.commit()
    await session.refresh(sub)
    return sub
