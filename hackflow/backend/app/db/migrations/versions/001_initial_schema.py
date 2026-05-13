"""initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def _create_enum_if_not_exists(name: str, values: str) -> None:
    op.execute(f"""
        DO $$ BEGIN
            CREATE TYPE {name} AS ENUM ({values});
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)


def upgrade() -> None:
    # ── ENUMS ─────────────────────────────────────────────────────────────────
    _create_enum_if_not_exists('userrole', "'hacker', 'mentor', 'judge', 'organizer'")
    _create_enum_if_not_exists('hackathonstatus', "'draft', 'upcoming', 'active', 'completed', 'cancelled'")
    _create_enum_if_not_exists('teamstatus', "'forming', 'active', 'submitted', 'eliminated', 'won'")
    _create_enum_if_not_exists('teammemberrole', "'leader', 'member'")
    _create_enum_if_not_exists('submissionstatus', "'draft', 'submitted', 'under_review', 'scored'")
    _create_enum_if_not_exists('ticketstatus', "'open', 'assigned', 'in_progress', 'resolved', 'closed'")
    _create_enum_if_not_exists('ticketpriority', "'low', 'medium', 'high'")
    _create_enum_if_not_exists('cardstatus', "'todo', 'in_progress', 'done'")
    _create_enum_if_not_exists('notificationtype', "'team_invite', 'mentor_assigned', 'score_update', 'event_reminder', 'submission_accepted', 'broadcast'")
    _create_enum_if_not_exists('notificationpriority', "'low', 'normal', 'high'")
    _create_enum_if_not_exists('syncstatus', "'pending', 'synced', 'failed'")

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('username', sa.String(64), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('role', postgresql.ENUM('hacker', 'mentor', 'judge', 'organizer', name='userrole', create_type=False), nullable=False, server_default='hacker'),
        sa.Column('github_id', sa.String(64), unique=True, nullable=True),
        sa.Column('github_username', sa.String(128), nullable=True),
        sa.Column('avatar_url', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )

    # ── user_profiles ─────────────────────────────────────────────────────────
    op.create_table(
        'user_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('bio', sa.Text, nullable=True),
        sa.Column('skills', postgresql.JSONB, nullable=True, server_default='[]'),
        sa.Column('tech_stack', postgresql.JSONB, nullable=True, server_default='[]'),
        sa.Column('years_experience', sa.Integer, nullable=True),
        sa.Column('mentoring_expertise', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # ── hackathons ────────────────────────────────────────────────────────────
    op.create_table(
        'hackathons',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('organizer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('status', postgresql.ENUM('draft', 'upcoming', 'active', 'completed', 'cancelled', name='hackathonstatus', create_type=False), nullable=False, server_default='draft'),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('submission_deadline', sa.DateTime(timezone=True), nullable=False),
        sa.Column('registration_deadline', sa.DateTime(timezone=True), nullable=False),
        sa.Column('max_team_size', sa.Integer, nullable=False),
        sa.Column('min_team_size', sa.Integer, nullable=False),
        sa.Column('max_participants', sa.Integer, nullable=True),
        sa.Column('discord_server_id', sa.String(64), nullable=True),
        sa.Column('banner_url', sa.Text, nullable=True),
        sa.Column('tags', postgresql.JSONB, nullable=True, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_hackathons_status', 'hackathons', ['status'])

    # ── teams ─────────────────────────────────────────────────────────────────
    op.create_table(
        'teams',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('hackathon_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hackathons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('status', postgresql.ENUM('forming', 'active', 'submitted', 'eliminated', 'won', name='teamstatus', create_type=False), nullable=False, server_default='forming'),
        sa.Column('leader_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('size', sa.Integer, nullable=False, server_default='1'),
        sa.Column('invite_token', sa.String(64), unique=True, nullable=False),
        sa.Column('invite_token_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('discord_text_channel_id', sa.String(64), nullable=True),
        sa.Column('discord_voice_channel_id', sa.String(64), nullable=True),
        sa.Column('avg_score', sa.Float, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_teams_hackathon_id', 'teams', ['hackathon_id'])

    # ── team_members ──────────────────────────────────────────────────────────
    op.create_table(
        'team_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', postgresql.ENUM('leader', 'member', name='teammemberrole', create_type=False), nullable=False, server_default='member'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('team_id', 'user_id', name='uq_team_members_team_user'),
    )

    # ── submissions ───────────────────────────────────────────────────────────
    op.create_table(
        'submissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('hackathon_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hackathons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('repository_url', sa.Text, nullable=False),
        sa.Column('video_pitch_url', sa.Text, nullable=True),
        sa.Column('presentation_url', sa.Text, nullable=True),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('status', postgresql.ENUM('draft', 'submitted', 'under_review', 'scored', name='submissionstatus', create_type=False), nullable=False, server_default='draft'),
        sa.Column('embedding_indexed', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('team_id', 'hackathon_id', name='uq_submissions_team_hackathon'),
    )

    # ── evaluation_criteria ───────────────────────────────────────────────────
    op.create_table(
        'evaluation_criteria',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('hackathon_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hackathons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('weight', sa.Float, nullable=False, server_default='1.0'),
        sa.Column('max_score', sa.Integer, nullable=False, server_default='10'),
        sa.Column('order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # ── evaluations ───────────────────────────────────────────────────────────
    op.create_table(
        'evaluations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('submission_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('submissions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('judge_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('criteria_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('evaluation_criteria.id'), nullable=False),
        sa.Column('score', sa.Integer, nullable=False),
        sa.Column('feedback', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('submission_id', 'judge_id', 'criteria_id', name='uq_evaluations'),
    )

    # ── helpdesk_tickets ──────────────────────────────────────────────────────
    op.create_table(
        'helpdesk_tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('hackathon_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hackathons.id'), nullable=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('assigned_mentor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('status', postgresql.ENUM('open', 'assigned', 'in_progress', 'resolved', 'closed', name='ticketstatus', create_type=False), nullable=False, server_default='open'),
        sa.Column('priority', postgresql.ENUM('low', 'medium', 'high', name='ticketpriority', create_type=False), nullable=False, server_default='medium'),
        sa.Column('category', sa.String(64), nullable=False),
        sa.Column('jitsi_room_url', sa.Text, nullable=True),
        sa.Column('session_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('session_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # ── kanban_cards ──────────────────────────────────────────────────────────
    op.create_table(
        'kanban_cards',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('assigned_to_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('status', postgresql.ENUM('todo', 'in_progress', 'done', name='cardstatus', create_type=False), nullable=False, server_default='todo'),
        sa.Column('priority', sa.Integer, nullable=False, server_default='2'),
        sa.Column('order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # ── notifications ─────────────────────────────────────────────────────────
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('hackathon_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hackathons.id'), nullable=True),
        sa.Column('type', postgresql.ENUM('team_invite', 'mentor_assigned', 'score_update', 'event_reminder', 'submission_accepted', 'broadcast', name='notificationtype', create_type=False), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('related_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('priority', postgresql.ENUM('low', 'normal', 'high', name='notificationpriority', create_type=False), nullable=False, server_default='normal'),
        sa.Column('is_read', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('email_sent', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])

    # ── github_stats ──────────────────────────────────────────────────────────
    op.create_table(
        'github_stats',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('repositories', sa.Integer, nullable=False, server_default='0'),
        sa.Column('followers', sa.Integer, nullable=False, server_default='0'),
        sa.Column('total_contributions', sa.Integer, nullable=False, server_default='0'),
        sa.Column('language_breakdown', postgresql.JSONB, nullable=True, server_default='{}'),
        sa.Column('cached_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # ── discord_integrations ──────────────────────────────────────────────────
    op.create_table(
        'discord_integrations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('discord_guild_id', sa.String(64), nullable=False),
        sa.Column('text_channel_id', sa.String(64), nullable=True),
        sa.Column('voice_channel_id', sa.String(64), nullable=True),
        sa.Column('sync_status', postgresql.ENUM('pending', 'synced', 'failed', name='syncstatus', create_type=False), nullable=False, server_default='pending'),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('last_sync', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Enable gen_random_uuid() extension (needed for UUID PK defaults)
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')


def downgrade() -> None:
    for table in [
        'discord_integrations', 'github_stats', 'notifications', 'kanban_cards',
        'helpdesk_tickets', 'evaluations', 'evaluation_criteria', 'submissions',
        'team_members', 'teams', 'hackathons', 'user_profiles', 'users',
    ]:
        op.drop_table(table)

    for enum in [
        'syncstatus', 'notificationpriority', 'notificationtype', 'cardstatus',
        'ticketpriority', 'ticketstatus', 'submissionstatus', 'teammemberrole',
        'teamstatus', 'hackathonstatus', 'userrole',
    ]:
        op.execute(f'DROP TYPE IF EXISTS {enum}')
