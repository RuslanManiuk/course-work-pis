from __future__ import annotations

from uuid import UUID

import httpx

from app.core.config import get_settings
from app.db.models.discord_integration import DiscordIntegration, SyncStatus

settings = get_settings()

DISCORD_API_BASE = "https://discord.com/api/v10"
CHANNEL_TYPE_TEXT = 0
CHANNEL_TYPE_VOICE = 2
CHANNEL_TYPE_CATEGORY = 4


class DiscordService:
    """Async Discord REST API client. No gateway, no discord.py."""

    def __init__(self) -> None:
        self._headers = {
            "Authorization": f"Bot {settings.discord_bot_token}",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        path: str,
        payload: dict | None = None,
        *,
        retries: int = 3,
    ) -> dict:
        url = f"{DISCORD_API_BASE}{path}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            for attempt in range(retries):
                response = await client.request(method, url, headers=self._headers, json=payload)
                if response.status_code == 429:
                    import asyncio

                    retry_after = float(response.json().get("retry_after", 1.0))
                    await asyncio.sleep(retry_after * (attempt + 1))
                    continue
                response.raise_for_status()
                return response.json()
        raise RuntimeError(f"Discord API failed after {retries} retries: {path}")

    async def get_or_create_category(self, guild_id: str, category_name: str) -> str:
        """Find or create a channel category in the guild."""
        channels: list = await self._request("GET", f"/guilds/{guild_id}/channels")
        for ch in channels:
            if ch["type"] == CHANNEL_TYPE_CATEGORY and ch["name"] == category_name:
                return ch["id"]

        created = await self._request(
            "POST",
            f"/guilds/{guild_id}/channels",
            {"name": category_name, "type": CHANNEL_TYPE_CATEGORY},
        )
        return created["id"]

    async def create_team_channels(
        self,
        guild_id: str,
        team_name: str,
        team_id: UUID,
        category_name: str = "hackflow-teams",
    ) -> tuple[str, str]:
        """
        Create a **private** text + voice channel pair for a team.
        @everyone is denied VIEW_CHANNEL; server administrators keep full access.
        Returns (text_channel_id, voice_channel_id).
        """
        category_id = await self.get_or_create_category(guild_id, category_name)
        safe_name = team_name.lower().replace(" ", "-")[:32]

        # Deny VIEW_CHANNEL (bit 1024) for @everyone (role id == guild_id)
        permission_overwrites = [
            {
                "id": guild_id,   # @everyone role
                "type": 0,        # 0 = role
                "allow": "0",
                "deny": "1024",   # VIEW_CHANNEL
            }
        ]

        text = await self._request(
            "POST",
            f"/guilds/{guild_id}/channels",
            {
                "name": safe_name,
                "type": CHANNEL_TYPE_TEXT,
                "parent_id": category_id,
                "topic": f"HackFlow team channel | team_id:{team_id}",
                "permission_overwrites": permission_overwrites,
            },
        )
        voice = await self._request(
            "POST",
            f"/guilds/{guild_id}/channels",
            {
                "name": f"{safe_name}-voice",
                "type": CHANNEL_TYPE_VOICE,
                "parent_id": category_id,
                "permission_overwrites": permission_overwrites,
            },
        )
        return text["id"], voice["id"]

    async def delete_channel(self, channel_id: str) -> None:
        await self._request("DELETE", f"/channels/{channel_id}")

    async def send_message(self, channel_id: str, content: str) -> None:
        await self._request("POST", f"/channels/{channel_id}/messages", {"content": content})


discord_service = DiscordService()
