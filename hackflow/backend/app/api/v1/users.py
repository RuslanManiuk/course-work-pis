from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import CurrentUser, get_session, require_role
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.models.github_stats import GithubStats
from app.db.models.user import User, UserRole
from app.schemas import GithubStatsResponse, UpdateProfileRequest, UserResponse, TeamResponse
from app.services.github_service import github_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser, session: AsyncSession = Depends(get_session)):
    await session.refresh(current_user, ["profile"])
    return current_user


@router.get("/me/teams", response_model=list[TeamResponse])
async def get_my_teams(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    from app.db.models.team import Team, TeamMember

    memberships = (
        await session.scalars(
            select(TeamMember).where(TeamMember.user_id == current_user.id)
        )
    ).all()
    if not memberships:
        return []

    team_ids = [m.team_id for m in memberships]
    teams = (
        await session.scalars(select(Team).where(Team.id.in_(team_ids)))
    ).all()

    settings = get_settings()
    result = []
    for t in teams:
        await session.refresh(t, ["members"])
        resp = TeamResponse.model_validate(t)
        resp.discord_guild_id = settings.discord_guild_id
        result.append(resp)
    return result


@router.put("/me/profile", response_model=UserResponse)
async def update_my_profile(
    body: UpdateProfileRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    await session.refresh(current_user, ["profile"])
    profile = current_user.profile
    if not profile:
        from app.db.models.profile import UserProfile

        profile = UserProfile(user_id=current_user.id)
        session.add(profile)
        await session.flush()

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(profile, field, value)

    await session.commit()
    await session.refresh(current_user, ["profile"])
    return current_user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: UUID, session: AsyncSession = Depends(get_session)):
    user = await session.get(User, user_id)
    if not user:
        raise NotFoundError("User", str(user_id))
    await session.refresh(user, ["profile"])
    return user


@router.get("/{user_id}/github-stats", response_model=GithubStatsResponse)
async def get_github_stats(
    user_id: UUID,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    stats = await session.scalar(select(GithubStats).where(GithubStats.user_id == user_id))
    if stats and github_service.is_cache_valid(stats):
        return stats
    raise NotFoundError("GitHub stats", "Cache miss — stats will be available after next login")


@router.put("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    role: UserRole,
    current_user: User = require_role(UserRole.organizer),
    session: AsyncSession = Depends(get_session),
):
    user = await session.get(User, user_id)
    if not user:
        raise NotFoundError("User", str(user_id))
    user.role = role
    await session.commit()
    return user
