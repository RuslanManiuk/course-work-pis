"""github private repo support

Revision ID: 002_github_private_repo
Revises: 001_initial_schema
Create Date: 2026-04-26 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '002_github_private_repo'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE repoaccessstatus AS ENUM ('accessible', 'pending', 'access_lost');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.add_column(
        'submissions',
        sa.Column('repo_is_private', sa.Boolean, nullable=False, server_default='false'),
    )
    op.add_column(
        'submissions',
        sa.Column(
            'repo_access_status',
            postgresql.ENUM('accessible', 'pending', 'access_lost', name='repoaccessstatus', create_type=False),
            nullable=False,
            server_default='accessible',
        ),
    )


def downgrade() -> None:
    op.drop_column('submissions', 'repo_access_status')
    op.drop_column('submissions', 'repo_is_private')
    op.execute("DROP TYPE IF EXISTS repoaccessstatus;")
