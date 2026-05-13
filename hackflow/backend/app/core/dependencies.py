from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token
from app.db.base import get_session
from app.db.models.user import User, UserRole

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: AsyncSession = Depends(get_session),
) -> User:
    if not credentials:
        raise UnauthorizedError()
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise UnauthorizedError("Invalid or expired token")

    if payload.get("type") != "access":
        raise UnauthorizedError("Expected access token")

    from sqlalchemy import select

    user_id: str = payload["sub"]
    result = await session.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise UnauthorizedError("User not found or deactivated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    async def _guard(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise ForbiddenError(
                f"Role '{current_user.role}' cannot access this resource"
            )
        return current_user

    return Depends(_guard)


# ── WebSocket token extraction ────────────────────────────────────────────────

async def get_ws_user(
    token: str = Query(...),
    session: AsyncSession = Depends(get_session),
) -> User:
    try:
        payload = decode_token(token)
    except JWTError:
        raise UnauthorizedError("Invalid WS token")
    if payload.get("type") != "access":
        raise UnauthorizedError()

    from sqlalchemy import select

    result = await session.execute(
        select(User).where(User.id == UUID(payload["sub"]))
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise UnauthorizedError()
    return user
