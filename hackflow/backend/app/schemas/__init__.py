from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.db.models.user import UserRole


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.hacker


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ── User & Profile ────────────────────────────────────────────────────────────

class SkillItem(BaseModel):
    name: str
    proficiency: str = "intermediate"  # beginner | intermediate | advanced


class TechItem(BaseModel):
    tech: str
    years: int = 0


class UserProfileResponse(BaseModel):
    id: UUID
    bio: str | None
    skills: list[SkillItem]
    tech_stack: list[TechItem]
    years_experience: int
    mentoring_expertise: list[Any] | None

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    role: UserRole
    github_username: str | None
    avatar_url: str | None
    is_active: bool
    created_at: datetime
    profile: UserProfileResponse | None = None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    bio: str | None = None
    skills: list[SkillItem] | None = None
    tech_stack: list[TechItem] | None = None
    years_experience: int | None = None
    mentoring_expertise: list[Any] | None = None


class GithubStatsResponse(BaseModel):
    repositories: int
    followers: int
    total_contributions: int
    language_breakdown: list[dict]
    cached_at: datetime

    model_config = {"from_attributes": True}


# ── Hackathon ─────────────────────────────────────────────────────────────────

class HackathonCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=256)
    description: str = Field(min_length=10)
    start_date: datetime
    end_date: datetime
    submission_deadline: datetime
    registration_deadline: datetime
    max_team_size: int = Field(ge=1, le=20, default=5)
    min_team_size: int = Field(ge=1, default=1)
    max_participants: int | None = None
    tags: list[dict] | None = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: datetime, info: Any) -> datetime:
        start = info.data.get("start_date")
        if start and v <= start:
            raise ValueError("end_date must be after start_date")
        return v


class HackathonUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    max_team_size: int | None = None
    tags: list[dict] | None = None


class HackathonResponse(BaseModel):
    id: UUID
    organizer_id: UUID
    title: str
    description: str
    status: str
    start_date: datetime
    end_date: datetime
    submission_deadline: datetime
    registration_deadline: datetime
    max_team_size: int
    min_team_size: int
    max_participants: int | None
    tags: list | None
    banner_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Team ──────────────────────────────────────────────────────────────────────

class TeamCreateRequest(BaseModel):
    hackathon_id: UUID
    name: str = Field(min_length=2, max_length=128)
    description: str | None = None


class TeamUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class TeamMemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    username: str
    avatar_url: str | None
    role: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class TeamResponse(BaseModel):
    id: UUID
    hackathon_id: UUID
    name: str
    description: str | None
    status: str
    leader_id: UUID
    size: int
    invite_token: str | None
    invite_token_expires_at: datetime | None = None
    discord_text_channel_id: str | None
    discord_voice_channel_id: str | None
    discord_guild_id: str | None = None
    avg_score: float
    created_at: datetime
    members: list[TeamMemberResponse] = []

    model_config = {"from_attributes": True}


class InvitePreviewResponse(BaseModel):
    team: TeamResponse
    can_join: bool
    reason: str | None = None


# ── Submission ────────────────────────────────────────────────────────────────

class SubmissionCreateRequest(BaseModel):
    repository_url: str = Field(min_length=5, max_length=512)
    video_pitch_url: str | None = None
    presentation_url: str | None = None
    description: str = Field(min_length=20)
    repo_is_private: bool = False


class SubmissionUpdateRequest(BaseModel):
    repository_url: str | None = None
    video_pitch_url: str | None = None
    presentation_url: str | None = None
    description: str | None = None
    repo_is_private: bool | None = None


class SubmissionResponse(BaseModel):
    id: UUID
    team_id: UUID
    hackathon_id: UUID
    repository_url: str
    video_pitch_url: str | None
    presentation_url: str | None
    description: str
    status: str
    embedding_indexed: bool
    repo_is_private: bool
    repo_access_status: str
    submitted_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Kanban ────────────────────────────────────────────────────────────────────

class KanbanCardCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    description: str | None = None
    priority: int = Field(ge=1, le=5, default=2)
    label: str | None = Field(None, max_length=32)
    due_date: datetime | None = None


class KanbanCardUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: int | None = Field(None, ge=1, le=5)
    label: str | None = Field(None, max_length=32)
    assigned_to_id: UUID | None = None
    due_date: datetime | None = None


class KanbanCardReorderItem(BaseModel):
    id: UUID
    status: str
    order: int


class KanbanCardReorderRequest(BaseModel):
    cards: list[KanbanCardReorderItem]


class KanbanCardResponse(BaseModel):
    id: UUID
    team_id: UUID
    title: str
    description: str | None
    status: str
    priority: int
    label: str | None = None
    order: int
    assigned_to_id: UUID | None
    due_date: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Help Desk ─────────────────────────────────────────────────────────────────

class TicketCreateRequest(BaseModel):
    hackathon_id: UUID
    team_id: UUID
    title: str = Field(min_length=5, max_length=256)
    description: str = Field(min_length=10)
    category: str = "general"
    priority: str = "medium"


class TicketUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None


class TicketEndSessionRequest(BaseModel):
    resolution_notes: str | None = None


class TicketResponse(BaseModel):
    id: UUID
    team_id: UUID
    hackathon_id: UUID
    created_by_id: UUID
    assigned_mentor_id: UUID | None
    title: str
    description: str
    status: str
    priority: str
    category: str
    jitsi_room_url: str | None
    session_start: datetime | None
    session_end: datetime | None
    resolution_notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Evaluation ────────────────────────────────────────────────────────────────

class CriteriaCreateItem(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    description: str = ''
    weight: float = Field(ge=0.0, le=100.0, default=1.0)
    max_score: int = Field(ge=1, le=100, default=10)
    order: int = 0


class CriteriaCreateRequest(BaseModel):
    criteria: list[CriteriaCreateItem]


class CriteriaResponse(BaseModel):
    id: UUID
    hackathon_id: UUID
    name: str
    description: str
    weight: float
    max_score: int
    order: int

    model_config = {"from_attributes": True}


class EvaluationItem(BaseModel):
    criteria_id: UUID
    score: int = Field(ge=1, le=10)
    feedback: str | None = None


class EvaluationSubmitRequest(BaseModel):
    evaluations: list[EvaluationItem]


class EvaluationResponse(BaseModel):
    id: UUID
    submission_id: UUID
    judge_id: UUID
    criteria_id: UUID
    score: int
    feedback: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Leaderboard ───────────────────────────────────────────────────────────────

class LeaderboardEntry(BaseModel):
    rank: int
    team_id: UUID
    team_name: str
    avg_score: float
    submission_id: UUID | None


class LeaderboardResponse(BaseModel):
    hackathon_id: UUID
    entries: list[LeaderboardEntry]
    total: int


# ── AI Assistant ──────────────────────────────────────────────────────────────

class AIQueryRequest(BaseModel):
    hackathon_id: UUID
    question: str = Field(min_length=5, max_length=1000)


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    message: str
    priority: str
    is_read: bool
    related_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BroadcastRequest(BaseModel):
    hackathon_id: UUID | None = None
    title: str
    message: str
    send_email: bool = False


# ── Winners ───────────────────────────────────────────────────────────────────

class WinnerCreateRequest(BaseModel):
    team_id: UUID
    rank: int = Field(ge=1, le=10)
    prize: str | None = Field(None, max_length=256)
    note: str | None = Field(None, max_length=512)


class WinnerUpdateRequest(BaseModel):
    rank: int | None = Field(None, ge=1, le=10)
    prize: str | None = Field(None, max_length=256)
    note: str | None = Field(None, max_length=512)


class WinnerResponse(BaseModel):
    id: UUID
    hackathon_id: UUID
    team_id: UUID
    team_name: str
    rank: int
    prize: str | None
    note: str | None
    avg_score: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Search (command palette) ──────────────────────────────────────────────────

class SearchHitHackathon(BaseModel):
    id: UUID
    title: str
    status: str
    end_date: datetime
    banner_url: str | None = None


class SearchHitTeam(BaseModel):
    id: UUID
    hackathon_id: UUID
    name: str
    hackathon_title: str | None = None
    size: int


class SearchHitUser(BaseModel):
    id: UUID
    username: str
    role: str
    avatar_url: str | None = None


class SearchResponse(BaseModel):
    query: str
    hackathons: list[SearchHitHackathon] = []
    teams: list[SearchHitTeam] = []
    users: list[SearchHitUser] = []
