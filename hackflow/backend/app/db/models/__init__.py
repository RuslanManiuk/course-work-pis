# Re-export all models for Alembic autogenerate
from app.db.models.user import User, UserRole
from app.db.models.profile import UserProfile
from app.db.models.hackathon import Hackathon, HackathonStatus
from app.db.models.team import Team, TeamMember, TeamStatus, TeamMemberRole
from app.db.models.submission import Submission, SubmissionStatus
from app.db.models.evaluation import Evaluation, EvaluationCriteria
from app.db.models.helpdesk import HelpDeskTicket, TicketStatus, TicketPriority
from app.db.models.kanban import KanbanCard, CardStatus
from app.db.models.notification import Notification, NotificationType
from app.db.models.github_stats import GithubStats
from app.db.models.discord_integration import DiscordIntegration, SyncStatus
from app.db.models.winner import HackathonWinner

__all__ = [
    "User", "UserRole",
    "UserProfile",
    "Hackathon", "HackathonStatus",
    "Team", "TeamMember", "TeamStatus", "TeamMemberRole",
    "Submission", "SubmissionStatus",
    "Evaluation", "EvaluationCriteria",
    "HelpDeskTicket", "TicketStatus", "TicketPriority",
    "KanbanCard", "CardStatus",
    "Notification", "NotificationType",
    "GithubStats",
    "DiscordIntegration", "SyncStatus",
    "HackathonWinner",
]
