"""winners table + kanban card label

Revision ID: 003_winners_and_card_labels
Revises: 002_github_private_repo
Create Date: 2026-05-03 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '003_winners_and_card_labels'
down_revision = '002_github_private_repo'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Kanban card label ──
    op.add_column(
        'kanban_cards',
        sa.Column('label', sa.String(length=32), nullable=True),
    )

    # ── Winners ──
    op.create_table(
        'hackathon_winners',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('hackathon_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rank', sa.Integer(), nullable=False),
        sa.Column('prize', sa.String(length=256), nullable=True),
        sa.Column('note', sa.String(length=512), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(['hackathon_id'], ['hackathons.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hackathon_id', 'rank', name='uq_winner_hackathon_rank'),
        sa.UniqueConstraint('hackathon_id', 'team_id', name='uq_winner_hackathon_team'),
    )
    op.create_index(
        'ix_hackathon_winners_hackathon_id', 'hackathon_winners', ['hackathon_id']
    )
    op.create_index('ix_hackathon_winners_team_id', 'hackathon_winners', ['team_id'])


def downgrade() -> None:
    op.drop_index('ix_hackathon_winners_team_id', table_name='hackathon_winners')
    op.drop_index('ix_hackathon_winners_hackathon_id', table_name='hackathon_winners')
    op.drop_table('hackathon_winners')
    op.drop_column('kanban_cards', 'label')
