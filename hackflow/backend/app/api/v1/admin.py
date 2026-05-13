from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, get_session, require_role
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.models.notification import Notification, NotificationType
from app.db.models.team import TeamMember
from app.db.models.user import User, UserRole
from app.schemas import BroadcastRequest, NotificationResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=list[dict])
async def list_users(
    role: UserRole | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: CurrentUser = None,
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != UserRole.organizer:
        raise ForbiddenError()

    q = select(User).order_by(User.created_at.desc())
    if role:
        q = q.where(User.role == role)
    q = q.offset((page - 1) * limit).limit(limit)
    users = (await session.scalars(q)).all()

    return [
        {
            "id": str(u.id),
            "email": u.email,
            "username": u.username,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.put("/users/{user_id}", response_model=dict)
async def update_user(
    user_id: UUID,
    role: UserRole | None = None,
    is_active: bool | None = None,
    current_user: CurrentUser = None,
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != UserRole.organizer:
        raise ForbiddenError()

    user = await session.get(User, user_id)
    if not user:
        raise NotFoundError("User", str(user_id))

    if role is not None:
        user.role = role
    if is_active is not None:
        user.is_active = is_active

    await session.commit()
    return {"id": str(user.id), "role": user.role, "is_active": user.is_active}


@router.post("/notifications/broadcast")
async def broadcast_notification(
    body: BroadcastRequest,
    background: BackgroundTasks,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != UserRole.organizer:
        raise ForbiddenError()

    # Resolve recipients
    if body.hackathon_id:
        memberships = (
            await session.scalars(
                select(TeamMember).join(
                    __import__("app.db.models.team", fromlist=["Team"]).Team,
                    TeamMember.team_id == __import__("app.db.models.team", fromlist=["Team"]).Team.id,
                ).where(
                    __import__("app.db.models.team", fromlist=["Team"]).Team.hackathon_id == body.hackathon_id
                )
            )
        ).all()
        recipient_ids = list({m.user_id for m in memberships})
    else:
        recipient_ids = [u.id for u in (await session.scalars(select(User).where(User.is_active == True))).all()]

    background.add_task(_send_broadcast, recipient_ids, body.hackathon_id, body.title, body.message, body.send_email)
    return {"queued": True, "recipients_count": len(recipient_ids)}


async def _send_broadcast(
    recipient_ids: list,
    hackathon_id: UUID | None,
    title: str,
    message: str,
    send_email: bool,
) -> None:
    from app.db.base import AsyncSessionLocal
    from app.websocket.manager import ws_manager
    from app.services.email_service import email_service
    from app.db.models.user import User

    async with AsyncSessionLocal() as session:
        for user_id in recipient_ids:
            notif = Notification(
                user_id=user_id,
                hackathon_id=hackathon_id,
                type=NotificationType.broadcast,
                title=title,
                message=message,
            )
            session.add(notif)
        await session.commit()

    for user_id in recipient_ids:
        await ws_manager.send_personal(user_id, "notification:broadcast", {"title": title, "message": message})

    if send_email:
        async with AsyncSessionLocal() as session:
            for user_id in recipient_ids:
                user = await session.get(User, user_id)
                if user:
                    try:
                        from email.mime.text import MIMEText
                        from email.mime.multipart import MIMEMultipart
                        import aiosmtplib
                        from app.core.config import get_settings

                        settings = get_settings()
                        msg = MIMEMultipart()
                        msg["Subject"] = title
                        msg["From"] = settings.email_from
                        msg["To"] = user.email
                        msg.attach(MIMEText(message, "plain"))
                        await aiosmtplib.send(
                            msg,
                            hostname=settings.smtp_host,
                            port=settings.smtp_port,
                            username=settings.smtp_user,
                            password=settings.smtp_pass,
                        )
                    except Exception:
                        pass


@router.get("/notifications", response_model=list[NotificationResponse])
async def get_my_notifications(
    unread_only: bool = False,
    current_user: CurrentUser = None,
    session: AsyncSession = Depends(get_session),
):
    q = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    if unread_only:
        q = q.where(Notification.is_read == False)
    return (await session.scalars(q)).all()


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    from datetime import datetime, timezone

    notif = await session.get(Notification, notification_id)
    if not notif or notif.user_id != current_user.id:
        raise NotFoundError("Notification", str(notification_id))

    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    await session.commit()
    return {"read": True}
