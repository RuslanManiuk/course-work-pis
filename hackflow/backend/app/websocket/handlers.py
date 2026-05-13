from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.exceptions import UnauthorizedError
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/ws", tags=["WebSocket"])


async def _authenticate_ws(websocket: WebSocket) -> UUID:
    """Extract and verify JWT from query param, return user_id."""
    from jose import JWTError

    from app.core.security import decode_token

    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        raise UnauthorizedError()
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise JWTError("Not access token")
        return UUID(payload["sub"])
    except (JWTError, ValueError):
        await websocket.close(code=4001, reason="Invalid token")
        raise UnauthorizedError()


@router.websocket("/teams/{team_id}")
async def team_ws(websocket: WebSocket, team_id: UUID) -> None:
    user_id = await _authenticate_ws(websocket)
    room = f"team:{team_id}"
    await ws_manager.connect(websocket, room)
    # Also join personal room for this session
    await ws_manager.connect(websocket, f"user:{user_id}")
    try:
        while True:
            data = await websocket.receive_text()
            # Client-to-server messages are currently ignored (read-only channel)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room)
        ws_manager.disconnect(websocket, f"user:{user_id}")


@router.websocket("/hackathons/{hackathon_id}")
async def hackathon_ws(websocket: WebSocket, hackathon_id: UUID) -> None:
    user_id = await _authenticate_ws(websocket)
    room = f"hackathon:{hackathon_id}"
    await ws_manager.connect(websocket, room)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room)


@router.websocket("/tickets/{ticket_id}")
async def ticket_ws(websocket: WebSocket, ticket_id: UUID) -> None:
    user_id = await _authenticate_ws(websocket)
    room = f"ticket:{ticket_id}"
    await ws_manager.connect(websocket, room)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room)


@router.websocket("/user/{user_id}")
async def user_ws(websocket: WebSocket, user_id: UUID) -> None:
    authed_user_id = await _authenticate_ws(websocket)
    if authed_user_id != user_id:
        await websocket.close(code=4003, reason="Forbidden")
        return
    room = f"user:{user_id}"
    await ws_manager.connect(websocket, room)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, room)
