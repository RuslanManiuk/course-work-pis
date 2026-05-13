from __future__ import annotations

from uuid import UUID

from app.core.config import get_settings

settings = get_settings()


class JitsiService:
    """Deterministic Jitsi Meet URL generator — no API key needed."""

    BASE_URL = "https://meet.jit.si"

    def get_room_url(self, ticket_id: UUID) -> str:
        return f"{self.BASE_URL}/hackflow-{ticket_id}"

    def get_team_room_url(self, team_id: UUID) -> str:
        return f"{self.BASE_URL}/hackflow-team-{team_id}"


jitsi_service = JitsiService()
