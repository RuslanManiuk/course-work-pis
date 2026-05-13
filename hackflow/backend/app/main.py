from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    # Verify DB connection
    from app.db.base import engine
    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))

    # Start background scheduled tasks
    from app.tasks.deadline_reminders import start_scheduler
    scheduler_task = start_scheduler()

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    scheduler_task.cancel()
    try:
        await scheduler_task
    except Exception:
        pass
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="HackFlow API",
        description="Hackathon automation platform",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url, "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    _register_routes(app)
    return app


def _register_routes(app: FastAPI) -> None:
    from app.api.v1 import (
        auth, users, hackathons, teams, matchmaking, workspace,
        helpdesk, judging, admin, winners, search,
    )
    from app.websocket.handlers import router as ws_router

    prefix = "/api/v1"
    app.include_router(auth.router, prefix=prefix)
    app.include_router(users.router, prefix=prefix)
    app.include_router(hackathons.router, prefix=prefix)
    app.include_router(winners.router, prefix=prefix)
    app.include_router(teams.router, prefix=prefix)
    app.include_router(matchmaking.router, prefix=prefix)
    app.include_router(workspace.router, prefix=prefix)
    app.include_router(helpdesk.router, prefix=prefix)
    app.include_router(judging.router, prefix=prefix)
    app.include_router(admin.router, prefix=prefix)
    app.include_router(search.router, prefix=prefix)
    app.include_router(ws_router)  # WebSocket routes (no prefix — /ws/...)


app = create_app()
