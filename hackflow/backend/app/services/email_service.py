from __future__ import annotations

from pathlib import Path

import aiosmtplib
from jinja2 import Environment, FileSystemLoader

from app.core.config import get_settings

settings = get_settings()

_templates_dir = Path(__file__).parent.parent / "templates" / "email"
_jinja = Environment(loader=FileSystemLoader(str(_templates_dir)), autoescape=True)


class EmailService:
    async def _send(self, to: str, subject: str, html_body: str) -> None:
        message = aiosmtplib.email.MIMEMultipart.MIMEMultipart("alternative")  # type: ignore[attr-defined]
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.email_from
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))

        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_pass,
            start_tls=True,
        )

    def _render(self, template_name: str, context: dict) -> str:
        template = _jinja.get_template(template_name)
        return template.render(**context)

    async def send_team_invite(self, to: str, team_name: str, invite_link: str, inviter_name: str) -> None:
        html = self._render("team_invite.html", {
            "team_name": team_name,
            "invite_link": invite_link,
            "inviter_name": inviter_name,
        })
        await self._send(to, f"You've been invited to join {team_name}", html)

    async def send_mentor_assigned(self, to: str, mentor_name: str, ticket_title: str, jitsi_url: str) -> None:
        html = self._render("mentor_assigned.html", {
            "mentor_name": mentor_name,
            "ticket_title": ticket_title,
            "jitsi_url": jitsi_url,
        })
        await self._send(to, f"Mentor assigned: {mentor_name}", html)

    async def send_score_published(self, to: str, team_name: str, avg_score: float) -> None:
        html = self._render("score_published.html", {
            "team_name": team_name,
            "avg_score": avg_score,
        })
        await self._send(to, f"Your project has been scored: {avg_score:.1f}/10", html)

    async def send_deadline_reminder(self, to: str, hackathon_title: str, hours_remaining: int, deadline_type: str) -> None:
        html = self._render("deadline_reminder.html", {
            "hackathon_title": hackathon_title,
            "hours_remaining": hours_remaining,
            "deadline_type": deadline_type,
        })
        await self._send(to, f"⏰ Reminder: {deadline_type} in {hours_remaining}h — {hackathon_title}", html)


email_service = EmailService()
