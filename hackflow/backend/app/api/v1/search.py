"""Search — global free-text lookup powering the ⌘K command palette."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, get_session
from app.db.models.hackathon import Hackathon
from app.db.models.team import Team
from app.db.models.user import User
from app.schemas import (
    SearchHitHackathon,
    SearchHitTeam,
    SearchHitUser,
    SearchResponse,
)

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("", response_model=SearchResponse)
async def search(
    current_user: CurrentUser,
    q: str = Query("", min_length=0, max_length=128),
    limit: int = Query(5, ge=1, le=15),
    session: AsyncSession = Depends(get_session),
):
    """Free-text search across hackathons, teams and users.

    Empty query returns the most recent items as a "browse" view.
    """
    qstr = q.strip()
    pattern = f"%{qstr}%"

    # ── Hackathons ──
    h_query = select(Hackathon)
    if qstr:
        h_query = h_query.where(
            or_(Hackathon.title.ilike(pattern), Hackathon.description.ilike(pattern))
        )
    h_query = h_query.order_by(Hackathon.start_date.desc()).limit(limit)
    hackathons = list((await session.scalars(h_query)).all())

    # ── Teams ──
    t_query = select(Team, Hackathon.title).join(
        Hackathon, Hackathon.id == Team.hackathon_id, isouter=True
    )
    if qstr:
        t_query = t_query.where(
            or_(Team.name.ilike(pattern), Team.description.ilike(pattern))
        )
    t_query = t_query.order_by(Team.created_at.desc()).limit(limit)
    team_rows = (await session.execute(t_query)).all()

    # ── Users (only when typing — privacy) ──
    users: list[User] = []
    if qstr:
        u_query = (
            select(User)
            .where(or_(User.username.ilike(pattern), User.email.ilike(pattern)))
            .order_by(User.created_at.desc())
            .limit(limit)
        )
        users = list((await session.scalars(u_query)).all())

    return SearchResponse(
        query=qstr,
        hackathons=[
            SearchHitHackathon(
                id=h.id,
                title=h.title,
                status=h.status.value if hasattr(h.status, "value") else str(h.status),
                end_date=h.end_date,
                banner_url=h.banner_url,
            )
            for h in hackathons
        ],
        teams=[
            SearchHitTeam(
                id=t.id,
                hackathon_id=t.hackathon_id,
                name=t.name,
                hackathon_title=h_title,
                size=t.size,
            )
            for t, h_title in team_rows
        ],
        users=[
            SearchHitUser(
                id=u.id,
                username=u.username,
                role=u.role.value if hasattr(u.role, "value") else str(u.role),
                avatar_url=u.avatar_url,
            )
            for u in users
        ],
    )
