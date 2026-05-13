from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    """
    Room-based WebSocket connection manager.
    Rooms are named strings like 'team:uuid', 'hackathon:uuid', 'user:uuid'.
    """

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room: str) -> None:
        await websocket.accept()
        self._rooms.setdefault(room, set()).add(websocket)

    def disconnect(self, websocket: WebSocket, room: str) -> None:
        room_set = self._rooms.get(room)
        if room_set:
            room_set.discard(websocket)
            if not room_set:
                del self._rooms[room]

    async def broadcast(self, room: str, event: str, payload: dict[str, Any]) -> None:
        """Send a typed event envelope to all connections in a room."""
        message = {
            "event": event,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        dead: list[WebSocket] = []
        for ws in self._rooms.get(room, set()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, room)

    async def send_personal(self, user_id: UUID, event: str, payload: dict[str, Any]) -> None:
        await self.broadcast(f"user:{user_id}", event, payload)

    def room_size(self, room: str) -> int:
        return len(self._rooms.get(room, set()))


# Singleton used throughout the app
ws_manager = ConnectionManager()
