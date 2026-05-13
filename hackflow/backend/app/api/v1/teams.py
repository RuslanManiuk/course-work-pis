from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import CurrentUser, get_session
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.db.models.team import Team, TeamMember, TeamMemberRole, TeamStatus
from app.schemas import (
    InvitePreviewResponse, TeamCreateRequest, TeamMemberResponse, TeamResponse, TeamUpdateRequest
)
from app.websocket.manager import ws_manager

settings = get_settings()
router = APIRouter(prefix="/teams", tags=["Teams"])

INVITE_TTL_HOURS = 72


async def _ensure_team_member(team: Team, user_id: UUID) -> bool:
    return any(m.user_id == user_id for m in team.members)


@router.post("", response_model=TeamResponse, status_code=201)
async def create_team(
    body: TeamCreateRequest,
    background: BackgroundTasks,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    from app.db.models.hackathon import Hackathon
    from app.db.models.discord_integration import DiscordIntegration, SyncStatus

    hackathon = await session.get(Hackathon, body.hackathon_id)
    if not hackathon:
        raise NotFoundError("Hackathon", str(body.hackathon_id))

    # Check user not already in a team for this hackathon
    existing_membership = await session.scalar(
        select(TeamMember)
        .join(Team)
        .where(Team.hackathon_id == body.hackathon_id, TeamMember.user_id == current_user.id)
    )
    if existing_membership:
        raise ConflictError("You are already in a team for this hackathon")

    invite_token = secrets.token_urlsafe(32)
    team = Team(
        hackathon_id=body.hackathon_id,
        name=body.name,
        description=body.description,
        leader_id=current_user.id,
        invite_token=invite_token,
        invite_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=INVITE_TTL_HOURS),
        size=1,
    )
    session.add(team)
    await session.flush()

    leader_membership = TeamMember(
        team_id=team.id, user_id=current_user.id, role=TeamMemberRole.leader
    )
    session.add(leader_membership)

    # Discord integration record (pending)
    discord_record = DiscordIntegration(
        team_id=team.id,
        discord_guild_id=settings.discord_guild_id,
        sync_status=SyncStatus.pending,
    )
    session.add(discord_record)
    await session.commit()
    await session.refresh(team, ["members"])

    # Trigger Discord channel creation as a background task
    if settings.discord_bot_token and settings.discord_guild_id:
        background.add_task(_create_discord_channels, team.id, team.name, body.hackathon_id)

    return team


async def _create_discord_channels(team_id: UUID, team_name: str, hackathon_id: UUID) -> None:
    from app.db.base import AsyncSessionLocal
    from app.db.models.discord_integration import DiscordIntegration, SyncStatus
    from app.services.discord_service import discord_service

    async with AsyncSessionLocal() as session:
        try:
            text_id, voice_id = await discord_service.create_team_channels(
                guild_id=settings.discord_guild_id,
                team_name=team_name,
                team_id=team_id,
                category_name="hackflow-teams",
            )
            team = await session.get(Team, team_id)
            if team:
                team.discord_text_channel_id = text_id
                team.discord_voice_channel_id = voice_id

            integration = await session.scalar(
                select(DiscordIntegration).where(DiscordIntegration.team_id == team_id)
            )
            if integration:
                integration.text_channel_id = text_id
                integration.voice_channel_id = voice_id
                integration.sync_status = SyncStatus.synced
                import datetime

                integration.last_sync = datetime.datetime.now(datetime.timezone.utc)

            await session.commit()

            await ws_manager.broadcast(
                f"team:{team_id}",
                "discord:channel-created",
                {"text_channel_id": text_id, "voice_channel_id": voice_id},
            )
        except Exception as exc:
            integration = await session.scalar(
                select(DiscordIntegration).where(DiscordIntegration.team_id == team_id)
            )
            if integration:
                integration.sync_status = SyncStatus.failed
                integration.error_message = str(exc)
            await session.commit()


class _JoinRequest(BaseModel):
    invite_token: str

@router.post("/{team_id}/join", response_model=TeamResponse)
async def join_team_by_token(
    team_id: UUID,
    body: _JoinRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    invite_token = body.invite_token
    team = await session.scalar(
        select(Team).where(Team.id == team_id, Team.invite_token == invite_token).with_for_update()
    )
    if not team:
        raise NotFoundError("Team or invite token", str(team_id))

    now = datetime.now(timezone.utc)
    if team.invite_token_expires_at and team.invite_token_expires_at.replace(tzinfo=timezone.utc) < now:
        raise ValidationError("Invite token has expired")

    from app.db.models.hackathon import Hackathon
    hackathon = await session.get(Hackathon, team.hackathon_id)
    if hackathon and team.size >= hackathon.max_team_size:
        raise ValidationError("Team is already full")

    existing_hackathon = await session.scalar(
        select(TeamMember)
        .join(Team)
        .where(Team.hackathon_id == team.hackathon_id, TeamMember.user_id == current_user.id)
    )
    if existing_hackathon:
        raise ConflictError("You are already in a team for this hackathon")

    member = TeamMember(team_id=team_id, user_id=current_user.id, role=TeamMemberRole.member)
    session.add(member)
    team.size += 1
    await session.commit()
    await session.refresh(team, ["members"])

    await ws_manager.broadcast(
        f"team:{team_id}",
        "member:joined",
        {"user_id": str(current_user.id), "username": current_user.username},
    )
    resp = TeamResponse.model_validate(team)
    resp.discord_guild_id = settings.discord_guild_id
    return resp


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(team_id: UUID, session: AsyncSession = Depends(get_session)):
    team = await session.get(Team, team_id)
    if not team:
        raise NotFoundError("Team", str(team_id))
    await session.refresh(team, ["members"])
    resp = TeamResponse.model_validate(team)
    resp.discord_guild_id = settings.discord_guild_id
    return resp


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: UUID,
    body: TeamUpdateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    team = await session.get(Team, team_id)
    if not team:
        raise NotFoundError("Team", str(team_id))
    if team.leader_id != current_user.id:
        raise ForbiddenError("Only the team leader can update team details")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(team, field, value)
    await session.commit()
    await session.refresh(team)
    return team


@router.get("/invite/{token}", response_model=InvitePreviewResponse)
async def preview_invite(token: str, session: AsyncSession = Depends(get_session)):
    team = await session.scalar(select(Team).where(Team.invite_token == token))
    if not team:
        return InvitePreviewResponse(
            team=None, can_join=False, reason="Invalid or expired invitation link"  # type: ignore
        )

    now = datetime.now(timezone.utc)
    expired = team.invite_token_expires_at and team.invite_token_expires_at.replace(tzinfo=timezone.utc) < now

    await session.refresh(team, ["members"])
    from app.db.models.hackathon import Hackathon

    hackathon = await session.get(Hackathon, team.hackathon_id)
    at_capacity = hackathon and team.size >= hackathon.max_team_size

    can_join = not expired and not at_capacity
    reason = None
    if expired:
        reason = "Invitation has expired"
    elif at_capacity:
        reason = f"Team is full ({team.size}/{hackathon.max_team_size})"

    return InvitePreviewResponse(team=team, can_join=can_join, reason=reason)


@router.post("/invite/{token}/accept", response_model=TeamResponse)
async def accept_invite(
    token: str,
    background: BackgroundTasks,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import text

    # Row-level lock to prevent race condition on team.size
    team = await session.scalar(
        select(Team).where(Team.invite_token == token).with_for_update()
    )
    if not team:
        raise NotFoundError("Invitation", token)

    now = datetime.now(timezone.utc)
    if team.invite_token_expires_at and team.invite_token_expires_at.replace(tzinfo=timezone.utc) < now:
        raise ValidationError("Invitation has expired")

    from app.db.models.hackathon import Hackathon

    hackathon = await session.get(Hackathon, team.hackathon_id)
    if hackathon and team.size >= hackathon.max_team_size:
        raise ValidationError("Team is already full")

    # Check not already in a team for this hackathon
    existing_hackathon = await session.scalar(
        select(TeamMember)
        .join(Team)
        .where(Team.hackathon_id == team.hackathon_id, TeamMember.user_id == current_user.id)
    )
    if existing_hackathon:
        raise ConflictError("You are already in a team for this hackathon")

    member = TeamMember(team_id=team.id, user_id=current_user.id, role=TeamMemberRole.member)
    session.add(member)
    team.size += 1
    await session.commit()
    await session.refresh(team, ["members"])

    await ws_manager.broadcast(
        f"team:{team.id}",
        "member:joined",
        {"user_id": str(current_user.id), "username": current_user.username},
    )
    return team


@router.post("/{team_id}/leave")
async def leave_team(
    team_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    team = await session.get(Team, team_id)
    if not team:
        raise NotFoundError("Team", str(team_id))

    membership = await session.scalar(
        select(TeamMember).where(
            TeamMember.team_id == team_id, TeamMember.user_id == current_user.id
        )
    )
    if not membership:
        raise NotFoundError("Team membership")
    if team.leader_id == current_user.id:
        raise ValidationError("Leader cannot leave — transfer leadership first")

    await session.delete(membership)
    team.size = max(0, team.size - 1)
    await session.commit()

    await ws_manager.broadcast(
        f"team:{team_id}",
        "member:left",
        {"user_id": str(current_user.id)},
    )
    return {"success": True}


@router.post("/{team_id}/regenerate-invite", response_model=TeamResponse)
async def regenerate_invite(
    team_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    team = await session.get(Team, team_id)
    if not team:
        raise NotFoundError("Team", str(team_id))
    if team.leader_id != current_user.id:
        raise ForbiddenError("Only the team leader can regenerate the invite token")

    team.invite_token = secrets.token_urlsafe(32)
    team.invite_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=INVITE_TTL_HOURS)
    await session.commit()
    await session.refresh(team, ["members"])
    resp = TeamResponse.model_validate(team)
    resp.discord_guild_id = settings.discord_guild_id
    return resp


@router.delete("/{team_id}/members/{user_id}")
async def remove_member(
    team_id: UUID,
    user_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    team = await session.get(Team, team_id)
    if not team:
        raise NotFoundError("Team", str(team_id))
    if team.leader_id != current_user.id:
        raise ForbiddenError("Only the team leader can remove members")
    if user_id == current_user.id:
        raise ValidationError("Use /leave to remove yourself")

    membership = await session.scalar(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
    )
    if not membership:
        raise NotFoundError("Team membership")

    await session.delete(membership)
    team.size = max(0, team.size - 1)
    await session.commit()
    return {"success": True}
