"""add announcements table

Revision ID: f9a3b2c1d4e5
Revises: e8f9a2b3c4d5
Create Date: 2026-05-13 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'f9a3b2c1d4e5'
down_revision = 'e8f9a2b3c4d5'
branch_labels = None
depends_on = None


def upgrade():
    # Create announcements table
    op.create_table(
        'announcements',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(50), server_default='normal', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )
    
    # Create indexes
    op.create_index('ix_announcements_id', 'announcements', ['id'])
    op.create_index('ix_announcements_is_active', 'announcements', ['is_active'])
    op.create_index('ix_announcements_created_at', 'announcements', ['created_at'])


def downgrade():
    # Drop announcements table
    op.drop_index('ix_announcements_created_at', 'announcements')
    op.drop_index('ix_announcements_is_active', 'announcements')
    op.drop_index('ix_announcements_id', 'announcements')
    op.drop_table('announcements')
