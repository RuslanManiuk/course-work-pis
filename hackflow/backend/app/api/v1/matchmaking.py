from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, get_session
from app.db.models.team import Team, TeamMember
from app.db.models.profile import UserProfile
from app.db.models.user import User
from app.schemas import TeamResponse

router = APIRouter(prefix="/matchmaking", tags=["Matchmaking"])


@router.get("/suggestions", response_model=list[dict])
async def get_suggestions(
    hackathon_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: int = Query(10, ge=1, le=50),
):
    """
    Returns teams that are looking for members with skills the current user has.
    Scores each team by skill gap — the more skills they lack that the user has, the higher the score.
    """
    await session.refresh(current_user, ["profile"])
    user_skills: set[str] = set()
    if current_user.profile and current_user.profile.skills:
        user_skills = {s["name"].lower() for s in current_user.profile.skills if isinstance(s, dict)}

    # All forming teams in the hackathon (user not already a member)
    teams_q = (
        select(Team)
        .where(Team.hackathon_id == hackathon_id, Team.status == "forming")
        .options(selectinload(Team.members))
    )
    teams = (await session.scalars(teams_q)).unique().all()

    suggestions = []
    for team in teams:
        # Skip teams the user is already in
        if any(m.user_id == current_user.id for m in team.members):
            continue

        member_skills: set[str] = set()
        for member in team.members:
            member_user = await session.get(User, member.user_id)
            if member_user:
                await session.refresh(member_user, ["profile"])
                if member_user.profile and member_user.profile.skills:
                    for s in member_user.profile.skills:
                        if isinstance(s, dict):
                            member_skills.add(s["name"].lower())

        skill_gap = user_skills - member_skills
        match_score = len(skill_gap) / max(len(user_skills), 1)

        suggestions.append({
            "team_id": str(team.id),
            "team_name": team.name,
            "description": team.description,
            "current_size": team.size,
            "skill_gap": list(skill_gap),
            "match_score": round(match_score, 2),
        })

    suggestions.sort(key=lambda x: x["match_score"], reverse=True)
    return suggestions[:limit]
