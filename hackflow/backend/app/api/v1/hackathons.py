from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import Body
from app.core.dependencies import CurrentUser, get_session, require_role
from app.core.exceptions import DeadlinePassedError, ForbiddenError, NotFoundError
from app.db.models.hackathon import Hackathon, HackathonStatus
from app.db.models.user import UserRole
from app.schemas import (
    HackathonCreateRequest, HackathonResponse, HackathonUpdateRequest, CriteriaCreateRequest, CriteriaResponse
)
from app.services.rag_service import rag_service

router = APIRouter(prefix="/hackathons", tags=["Hackathons"])


@router.get("", response_model=list[HackathonResponse])
async def list_hackathons(
    status: HackathonStatus | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    q = select(Hackathon).order_by(Hackathon.start_date.desc())
    if status:
        q = q.where(Hackathon.status == status)
    q = q.offset((page - 1) * limit).limit(limit)
    result = await session.scalars(q)
    return result.all()


@router.get("/{hackathon_id}", response_model=HackathonResponse)
async def get_hackathon(hackathon_id: UUID, session: AsyncSession = Depends(get_session)):
    h = await session.get(Hackathon, hackathon_id)
    if not h:
        raise NotFoundError("Hackathon", str(hackathon_id))
    return h


@router.post("", response_model=HackathonResponse, status_code=201)
async def create_hackathon(
    body: HackathonCreateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != UserRole.organizer:
        raise ForbiddenError("Only organizers can create hackathons")

    h = Hackathon(**body.model_dump(), organizer_id=current_user.id)
    session.add(h)
    await session.commit()
    await session.refresh(h)
    return h


@router.put("/{hackathon_id}", response_model=HackathonResponse)
async def update_hackathon(
    hackathon_id: UUID,
    body: HackathonUpdateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    h = await session.get(Hackathon, hackathon_id)
    if not h:
        raise NotFoundError("Hackathon", str(hackathon_id))
    if h.organizer_id != current_user.id and current_user.role != UserRole.organizer:
        raise ForbiddenError()

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(h, field, value)
    await session.commit()
    await session.refresh(h)
    return h


@router.post("/{hackathon_id}/criteria", response_model=list[CriteriaResponse], status_code=201)
async def create_criteria(
    hackathon_id: UUID,
    body: CriteriaCreateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    from app.db.models.evaluation import EvaluationCriteria

    if current_user.role != UserRole.organizer:
        raise ForbiddenError()
    h = await session.get(Hackathon, hackathon_id)
    if not h:
        raise NotFoundError("Hackathon", str(hackathon_id))

    created = []
    for item in body.criteria:
        c = EvaluationCriteria(hackathon_id=hackathon_id, **item.model_dump())
        session.add(c)
        created.append(c)

    await session.commit()
    for c in created:
        await session.refresh(c)
    return created


@router.get("/{hackathon_id}/criteria", response_model=list[CriteriaResponse])
async def get_criteria(hackathon_id: UUID, session: AsyncSession = Depends(get_session)):
    from app.db.models.evaluation import EvaluationCriteria

    result = await session.scalars(
        select(EvaluationCriteria)
        .where(EvaluationCriteria.hackathon_id == hackathon_id)
        .order_by(EvaluationCriteria.order)
    )
    return result.all()


@router.post("/{hackathon_id}/criteria/generate")
async def generate_criteria_with_ai(
    hackathon_id: UUID,
    current_user: CurrentUser,
    n: int = Body(default=5, ge=1, le=10, embed=True),
    session: AsyncSession = Depends(get_session),
):
    """Use Gemini AI to suggest evaluation criteria for this hackathon."""
    if current_user.role != UserRole.organizer:
        raise ForbiddenError("Only organizers can generate criteria")

    h = await session.get(Hackathon, hackathon_id)
    if not h:
        raise NotFoundError("Hackathon", str(hackathon_id))

    try:
        suggestions = await rag_service.generate_criteria(
            hackathon_title=h.title,
            hackathon_description=h.description or "",
            n=n,
        )
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}") from exc

    return {"suggestions": suggestions}


@router.post("/ai-describe")
async def ai_generate_description(
    current_user: CurrentUser,
    title: str = Body(..., embed=True),
):
    """Generate a compelling hackathon description from just a title."""
    if current_user.role != UserRole.organizer:
        raise ForbiddenError("Only organizers can use AI description generation")

    from app.services.rag_service import _chat
    prompt = f"""You are an enthusiastic hackathon organizer writing a description for a new hackathon.
Given the title below, write a compelling 2-3 sentence description for participants.
Be specific, energetic, and highlight what makes this hackathon exciting.
Do NOT include dates or prizes. Only output the description text, nothing else.

Hackathon title: {title}"""

    try:
        description = await _chat([{"role": "user", "content": prompt}])
        return {"description": description.strip()}
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}") from exc
