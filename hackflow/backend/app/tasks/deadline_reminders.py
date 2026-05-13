"""Deadline reminder scheduled tasks.

Runs as a background asyncio task started during app lifespan.
Checks every 30 minutes for upcoming hackathon deadlines and sends email reminders.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.base import AsyncSessionLocal
from app.db.models.hackathon import Hackathon, HackathonStatus
from app.db.models.team import Team, TeamMember
from app.db.models.user import User
from app.services.email_service import email_service

logger = logging.getLogger(__name__)

# Hours before deadline when reminders are sent
REMINDER_INTERVALS = [48, 24, 1]
CHECK_INTERVAL_SECONDS = 1800  # 30 minutes


async def _send_reminders_for_deadline(
    hackathon_title: str,
    deadline_type: str,
    deadline_at: datetime,
    session,
) -> None:
    """Send reminders to all active team members if deadline is within a trigger window."""
    now = datetime.now(timezone.utc)
    deadline_utc = deadline_at.replace(tzinfo=timezone.utc) if deadline_at.tzinfo is None else deadline_at
    hours_remaining = (deadline_utc - now).total_seconds() / 3600

    # Check if we're within any reminder window (±15 min tolerance)
    triggered: int | None = None
    for hours in REMINDER_INTERVALS:
        if abs(hours_remaining - hours) <= 0.25:
            triggered = hours
            break

    if triggered is None:
        return

    logger.info("Sending %s reminders for '%s' (%dh window)", deadline_type, hackathon_title, triggered)

    # Get all active teams for hackathons
    hackathons = (
        await session.scalars(
            select(Hackathon).where(
                Hackathon.status.in_([HackathonStatus.active, HackathonStatus.upcoming])
            )
        )
    ).all()

    for hackathon in hackathons:
        if hackathon.title != hackathon_title:
            continue
        teams = (
            await session.scalars(select(Team).where(Team.hackathon_id == hackathon.id))
        ).all()

        for team in teams:
            members = (
                await session.scalars(
                    select(TeamMember).where(TeamMember.team_id == team.id)
                )
            ).all()

            for member in members:
                user = await session.get(User, member.user_id)
                if not user or not user.is_active:
                    continue
                try:
                    await email_service.send_deadline_reminder(
                        to=user.email,
                        hackathon_title=hackathon.title,
                        hours_remaining=triggered,
                        deadline_type=deadline_type,
                    )
                except Exception as exc:
                    logger.warning("Failed to send reminder to %s: %s", user.email, exc)


async def run_deadline_reminders() -> None:
    """Periodic task: check all active hackathons for upcoming deadlines."""
    while True:
        try:
            async with AsyncSessionLocal() as session:
                hackathons = (
                    await session.scalars(
                        select(Hackathon).where(
                            Hackathon.status.in_([HackathonStatus.active, HackathonStatus.upcoming])
                        )
                    )
                ).all()

                for hackathon in hackathons:
                    await _send_reminders_for_deadline(
                        hackathon_title=hackathon.title,
                        deadline_type="Submission Deadline",
                        deadline_at=hackathon.submission_deadline,
                        session=session,
                    )
                    await _send_reminders_for_deadline(
                        hackathon_title=hackathon.title,
                        deadline_type="Registration Deadline",
                        deadline_at=hackathon.registration_deadline,
                        session=session,
                    )
        except asyncio.CancelledError:
            logger.info("Deadline reminder task cancelled")
            return
        except Exception as exc:
            logger.error("Deadline reminder task error: %s", exc, exc_info=True)

        await asyncio.sleep(CHECK_INTERVAL_SECONDS)


def start_scheduler() -> asyncio.Task:
    """Create and return the background scheduler task."""
    return asyncio.create_task(run_deadline_reminders(), name="deadline-reminders")
