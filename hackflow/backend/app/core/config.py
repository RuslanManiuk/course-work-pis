from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── App ──────────────────────────────────────────────────────────────────
    environment: Literal["development", "production", "test"] = "development"
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = "redis://redis:6379/0"

    # ── ChromaDB ─────────────────────────────────────────────────────────────
    chroma_host: str = "chromadb"
    chroma_port: int = 8000

    # ── JWT ──────────────────────────────────────────────────────────────────
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # ── GitHub OAuth ─────────────────────────────────────────────────────────
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/api/v1/auth/github/callback"
    # PAT of the service account used to access private repos as collaborator
    github_bot_token: str = ""

    # ── Discord ──────────────────────────────────────────────────────────────
    discord_bot_token: str = ""
    discord_guild_id: str = ""

    # ── Gemini ───────────────────────────────────────────────────────────────
    gemini_api_key: str = ""

    # ── OpenRouter ───────────────────────────────────────────────────────────
    openrouter_api_key: str = ""

    # ── SMTP ─────────────────────────────────────────────────────────────────
    smtp_host: str = "sandbox.smtp.mailtrap.io"
    smtp_port: int = 2525
    smtp_user: str = ""
    smtp_pass: str = ""
    email_from: str = "noreply@hackflow.dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
