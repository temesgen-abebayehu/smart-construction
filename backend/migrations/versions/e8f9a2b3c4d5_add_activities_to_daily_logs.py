"""remove activities field and add daily_log_activities table

Revision ID: e8f9a2b3c4d5
Revises: d2f60a9b1c34
Create Date: 2026-05-12 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'e8f9a2b3c4d5'
down_revision = 'd2f60a9b1c34'
branch_labels = None
depends_on = None


def upgrade():
    # Remove activities column from daily_logs table (if it exists)
    try:
        op.drop_column('daily_logs', 'activities')
    except:
        pass  # Column might not exist
    
    # Create daily_log_activities table
    op.create_table(
        'daily_log_activities',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('log_id', UUID(as_uuid=True), sa.ForeignKey('daily_logs.id'), nullable=False),
        sa.Column('task_activity_id', UUID(as_uuid=True), sa.ForeignKey('task_activities.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Create indexes
    op.create_index('ix_daily_log_activities_log_id', 'daily_log_activities', ['log_id'])
    op.create_index('ix_daily_log_activities_task_activity_id', 'daily_log_activities', ['task_activity_id'])


def downgrade():
    # Drop daily_log_activities table
    op.drop_index('ix_daily_log_activities_task_activity_id', 'daily_log_activities')
    op.drop_index('ix_daily_log_activities_log_id', 'daily_log_activities')
    op.drop_table('daily_log_activities')
    
    # Re-add activities column
    op.add_column('daily_logs', sa.Column('activities', sa.Text(), nullable=True))

