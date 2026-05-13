from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, get_session, require_role
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.db.models.helpdesk import HelpDeskTicket, TicketStatus
from app.db.models.user import UserRole
from app.schemas import (
    TicketCreateRequest, TicketEndSessionRequest, TicketResponse, TicketUpdateRequest
)
from app.services.jitsi_service import jitsi_service
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/helpdesk", tags=["Help Desk"])


@router.post("/tickets", response_model=TicketResponse, status_code=201)
async def create_ticket(
    body: TicketCreateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    ticket = HelpDeskTicket(
        **body.model_dump(),
        created_by_id=current_user.id,
        status=TicketStatus.open,
    )
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)

    await ws_manager.broadcast(
        f"hackathon:{body.hackathon_id}",
        "helpdesk:ticket-created",
        {"ticket_id": str(ticket.id), "title": ticket.title, "priority": ticket.priority},
    )
    return ticket


@router.get("/tickets", response_model=list[TicketResponse])
async def list_tickets(
    hackathon_id: UUID | None = None,
    team_id: UUID | None = None,
    status: TicketStatus | None = None,
    current_user: CurrentUser = None,
    session: AsyncSession = Depends(get_session),
):
    q = select(HelpDeskTicket).order_by(HelpDeskTicket.created_at.asc())
    if hackathon_id:
        q = q.where(HelpDeskTicket.hackathon_id == hackathon_id)
    if team_id:
        q = q.where(HelpDeskTicket.team_id == team_id)
    if status:
        q = q.where(HelpDeskTicket.status == status)
    return (await session.scalars(q)).all()


@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: UUID, session: AsyncSession = Depends(get_session)):
    ticket = await session.get(HelpDeskTicket, ticket_id)
    if not ticket:
        raise NotFoundError("Ticket", str(ticket_id))
    return ticket


@router.put("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: UUID,
    body: TicketUpdateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    ticket = await session.get(HelpDeskTicket, ticket_id)
    if not ticket:
        raise NotFoundError("Ticket", str(ticket_id))
    if ticket.created_by_id != current_user.id:
        raise ForbiddenError()
    if ticket.status != TicketStatus.open:
        raise ValidationError("Only open tickets can be modified")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(ticket, field, value)
    await session.commit()
    await session.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/assign", response_model=TicketResponse)
async def assign_ticket(
    ticket_id: UUID,
    background: BackgroundTasks,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != UserRole.mentor:
        raise ForbiddenError("Only mentors can accept tickets")

    ticket = await session.get(HelpDeskTicket, ticket_id)
    if not ticket:
        raise NotFoundError("Ticket", str(ticket_id))
    if ticket.status != TicketStatus.open:
        raise ValidationError("Ticket is no longer available")

    ticket.assigned_mentor_id = current_user.id
    ticket.status = TicketStatus.assigned
    ticket.jitsi_room_url = jitsi_service.get_room_url(ticket_id)

    await session.commit()
    await session.refresh(ticket)

    await ws_manager.broadcast(
        f"ticket:{ticket_id}",
        "ticket:assigned",
        {
            "mentor_id": str(current_user.id),
            "mentor_name": current_user.username,
            "jitsi_room_url": ticket.jitsi_room_url,
        },
    )
    await ws_manager.send_personal(
        current_user.id,
        "mentor:assigned",
        {"ticket_id": str(ticket_id), "ticket_title": ticket.title},
    )

    # Email notification as background task
    background.add_task(_notify_mentor_assigned, ticket.id)
    return ticket


async def _notify_mentor_assigned(ticket_id: UUID) -> None:
    from app.db.base import AsyncSessionLocal
    from app.db.models.helpdesk import HelpDeskTicket
    from app.db.models.user import User
    from app.services.email_service import email_service

    async with AsyncSessionLocal() as session:
        ticket = await session.get(HelpDeskTicket, ticket_id)
        if not ticket or not ticket.assigned_mentor_id:
            return
        mentor = await session.get(User, ticket.assigned_mentor_id)
        creator = await session.get(User, ticket.created_by_id)
        if creator and mentor and ticket.jitsi_room_url:
            try:
                await email_service.send_mentor_assigned(
                    to=creator.email,
                    mentor_name=mentor.username,
                    ticket_title=ticket.title,
                    jitsi_url=ticket.jitsi_room_url,
                )
            except Exception:
                pass


@router.post("/tickets/{ticket_id}/start-session", response_model=TicketResponse)
async def start_session(
    ticket_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    from datetime import datetime, timezone

    ticket = await session.get(HelpDeskTicket, ticket_id)
    if not ticket:
        raise NotFoundError("Ticket", str(ticket_id))
    if ticket.assigned_mentor_id != current_user.id:
        raise ForbiddenError("Only the assigned mentor can start the session")

    ticket.status = TicketStatus.in_progress
    ticket.session_start = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(ticket)

    await ws_manager.broadcast(
        f"ticket:{ticket_id}", "session:started", {"jitsi_room_url": ticket.jitsi_room_url}
    )
    return ticket


@router.post("/tickets/{ticket_id}/end-session", response_model=TicketResponse)
async def end_session(
    ticket_id: UUID,
    body: TicketEndSessionRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    from datetime import datetime, timezone

    ticket = await session.get(HelpDeskTicket, ticket_id)
    if not ticket:
        raise NotFoundError("Ticket", str(ticket_id))
    if ticket.assigned_mentor_id != current_user.id:
        raise ForbiddenError()

    ticket.status = TicketStatus.resolved
    ticket.session_end = datetime.now(timezone.utc)
    if body.resolution_notes:
        ticket.resolution_notes = body.resolution_notes
    await session.commit()
    await session.refresh(ticket)

    await ws_manager.broadcast(
        f"ticket:{ticket_id}", "session:ended", {"resolved_at": ticket.session_end.isoformat()}
    )
    return ticket


@router.post("/tickets/{ticket_id}/ai-suggest-notes")
async def ai_suggest_resolution_notes(
    ticket_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Ask AI to suggest resolution notes for a helpdesk ticket based on its title and description."""
    from app.db.models.user import UserRole
    if current_user.role != UserRole.mentor:
        raise ForbiddenError("Only mentors can use AI note suggestions")

    ticket = await session.get(HelpDeskTicket, ticket_id)
    if not ticket:
        raise NotFoundError("Ticket", str(ticket_id))

    from app.services.rag_service import _chat
    prompt = f"""You are a helpful hackathon mentor.
A participant submitted the following support request. Write concise, friendly resolution notes
summarizing what you would tell them to resolve the issue.

Ticket title: {ticket.title}
Ticket description: {ticket.description or "(no description)"}
Category: {ticket.category}

Write only the resolution notes — 2-4 sentences, no preamble, no "Here are the notes:"."""

    try:
        notes = await _chat([{"role": "user", "content": prompt}])
        return {"notes": notes.strip()}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"AI suggestion failed: {e}")


@router.get("/mentor/queue", response_model=list[TicketResponse])
async def mentor_queue(
    hackathon_id: UUID | None = None,
    current_user: CurrentUser = None,
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != UserRole.mentor:
        raise ForbiddenError("Only mentors can view the queue")

    q = (
        select(HelpDeskTicket)
        .where(HelpDeskTicket.status == TicketStatus.open)
        .order_by(HelpDeskTicket.created_at.asc())
    )
    if hackathon_id:
        q = q.where(HelpDeskTicket.hackathon_id == hackathon_id)
    return (await session.scalars(q)).all()


@router.get("/mentor/my-tickets", response_model=list[TicketResponse])
async def mentor_my_tickets(
    current_user: CurrentUser = None,
    session: AsyncSession = Depends(get_session),
):
    """Returns tickets currently assigned to this mentor (assigned or in_progress)."""
    if current_user.role not in (UserRole.mentor, UserRole.organizer):
        raise ForbiddenError("Only mentors can view their tickets")

    q = (
        select(HelpDeskTicket)
        .where(
            HelpDeskTicket.assigned_mentor_id == current_user.id,
            HelpDeskTicket.status.in_([TicketStatus.assigned, TicketStatus.in_progress]),
        )
        .order_by(HelpDeskTicket.created_at.asc())
    )
    return (await session.scalars(q)).all()
