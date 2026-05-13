"""Winners — organizers crown the top teams of a completed hackathon."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, get_session
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.db.models.hackathon import Hackathon
from app.db.models.team import Team, TeamStatus
from app.db.models.user import UserRole
from app.db.models.winner import HackathonWinner
from app.schemas import WinnerCreateRequest, WinnerResponse, WinnerUpdateRequest

router = APIRouter(prefix="/hackathons", tags=["Winners"])


def _to_response(w: HackathonWinner, team: Team) -> WinnerResponse:
    return WinnerResponse(
        id=w.id,
        hackathon_id=w.hackathon_id,
        team_id=w.team_id,
        team_name=team.name,
        rank=w.rank,
        prize=w.prize,
        note=w.note,
        avg_score=team.avg_score,
        created_at=w.created_at,
    )


async def _load_winners(session: AsyncSession, hackathon_id: UUID) -> list[WinnerResponse]:
    rows = await session.execute(
        select(HackathonWinner, Team)
        .join(Team, Team.id == HackathonWinner.team_id)
        .where(HackathonWinner.hackathon_id == hackathon_id)
        .order_by(HackathonWinner.rank.asc())
    )
    return [_to_response(w, t) for w, t in rows.all()]


def _ensure_organizer(current_user, hackathon: Hackathon) -> None:
    if current_user.role != UserRole.organizer:
        raise ForbiddenError("Only organizers can manage winners")
    if hackathon.organizer_id != current_user.id:
        raise ForbiddenError("Only the hackathon's organizer can manage its winners")


@router.get("/{hackathon_id}/winners", response_model=list[WinnerResponse])
async def list_winners(hackathon_id: UUID, session: AsyncSession = Depends(get_session)):
    h = await session.get(Hackathon, hackathon_id)
    if not h:
        raise NotFoundError("Hackathon", str(hackathon_id))
    return await _load_winners(session, hackathon_id)


@router.post("/{hackathon_id}/winners", response_model=WinnerResponse, status_code=201)
async def create_winner(
    hackathon_id: UUID,
    body: WinnerCreateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    h = await session.get(Hackathon, hackathon_id)
    if not h:
        raise NotFoundError("Hackathon", str(hackathon_id))
    _ensure_organizer(current_user, h)

    team = await session.get(Team, body.team_id)
    if not team:
        raise NotFoundError("Team", str(body.team_id))
    if team.hackathon_id != hackathon_id:
        raise ValidationError("Team does not belong to this hackathon")

    # If a winner already exists for this team, update it (idempotent upsert by team).
    existing = await session.scalar(
        select(HackathonWinner).where(
            HackathonWinner.hackathon_id == hackathon_id,
            HackathonWinner.team_id == body.team_id,
        )
    )
    if existing:
        existing.rank = body.rank
        existing.prize = body.prize
        existing.note = body.note
    else:
        existing = HackathonWinner(
            hackathon_id=hackathon_id,
            team_id=body.team_id,
            rank=body.rank,
            prize=body.prize,
            note=body.note,
        )
        session.add(existing)

    # Mark the team as won
    team.status = TeamStatus.won

    await session.commit()
    await session.refresh(existing)
    await session.refresh(team)
    return _to_response(existing, team)


@router.patch("/{hackathon_id}/winners/{winner_id}", response_model=WinnerResponse)
async def update_winner(
    hackathon_id: UUID,
    winner_id: UUID,
    body: WinnerUpdateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    h = await session.get(Hackathon, hackathon_id)
    if not h:
        raise NotFoundError("Hackathon", str(hackathon_id))
    _ensure_organizer(current_user, h)

    winner = await session.get(HackathonWinner, winner_id)
    if not winner or winner.hackathon_id != hackathon_id:
        raise NotFoundError("Winner", str(winner_id))

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(winner, field, value)

    await session.commit()
    await session.refresh(winner)

    team = await session.get(Team, winner.team_id)
    return _to_response(winner, team)


@router.delete("/{hackathon_id}/winners/{winner_id}", status_code=204)
async def delete_winner(
    hackathon_id: UUID,
    winner_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    h = await session.get(Hackathon, hackathon_id)
    if not h:
        raise NotFoundError("Hackathon", str(hackathon_id))
    _ensure_organizer(current_user, h)

    winner = await session.get(HackathonWinner, winner_id)
    if not winner or winner.hackathon_id != hackathon_id:
        raise NotFoundError("Winner", str(winner_id))

    team = await session.get(Team, winner.team_id)
    if team and team.status == TeamStatus.won:
        # Reset to submitted so the team isn't stuck as "won" after un-crowning.
        team.status = TeamStatus.submitted

    await session.delete(winner)
    await session.commit()
    return None


@router.post(
    "/{hackathon_id}/winners/auto",
    response_model=list[WinnerResponse],
    summary="Auto-pick winners from top judging scores",
)
async def auto_winners(
    hackathon_id: UUID,
    current_user: CurrentUser,
    top: int = 3,
    session: AsyncSession = Depends(get_session),
):
    """Take the top N teams by avg_score and crown them as winners (rank 1..N)."""
    h = await session.get(Hackathon, hackathon_id)
    if not h:
        raise NotFoundError("Hackathon", str(hackathon_id))
    _ensure_organizer(current_user, h)

    if top < 1 or top > 10:
        raise ValidationError("top must be between 1 and 10")

    rows = await session.scalars(
        select(Team)
        .where(Team.hackathon_id == hackathon_id, Team.avg_score > 0)
        .order_by(Team.avg_score.desc())
        .limit(top)
    )
    top_teams = list(rows.all())
    if not top_teams:
        raise ValidationError("No teams with judging scores yet")

    # Wipe existing winners for this hackathon, recreate fresh.
    existing_rows = await session.scalars(
        select(HackathonWinner).where(HackathonWinner.hackathon_id == hackathon_id)
    )
    for w in existing_rows:
        await session.delete(w)

    created: list[HackathonWinner] = []
    for idx, team in enumerate(top_teams, start=1):
        w = HackathonWinner(
            hackathon_id=hackathon_id,
            team_id=team.id,
            rank=idx,
            prize=None,
            note=f"Auto-selected by avg_score ({team.avg_score:.2f})",
        )
        session.add(w)
        team.status = TeamStatus.won
        created.append(w)

    await session.commit()
    for w in created:
        await session.refresh(w)

    return await _load_winners(session, hackathon_id)
