"""fix daily_log_activities cascade delete

Revision ID: fix_cascade_001
Revises: merge_heads_001
Create Date: 2024-05-14

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fix_cascade_001'
down_revision = 'merge_heads_001'
branch_labels = None
depends_on = None


def upgrade():
    # Drop existing foreign key constraints
    op.drop_constraint('daily_log_activities_log_id_fkey', 'daily_log_activities', type_='foreignkey')
    op.drop_constraint('daily_log_activities_task_activity_id_fkey', 'daily_log_activities', type_='foreignkey')
    
    # Recreate with CASCADE delete
    op.create_foreign_key(
        'daily_log_activities_log_id_fkey',
        'daily_log_activities', 'daily_logs',
        ['log_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'daily_log_activities_task_activity_id_fkey',
        'daily_log_activities', 'task_activities',
        ['task_activity_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade():
    # Drop CASCADE constraints
    op.drop_constraint('daily_log_activities_log_id_fkey', 'daily_log_activities', type_='foreignkey')
    op.drop_constraint('daily_log_activities_task_activity_id_fkey', 'daily_log_activities', type_='foreignkey')
    
    # Recreate without CASCADE
    op.create_foreign_key(
        'daily_log_activities_log_id_fkey',
        'daily_log_activities', 'daily_logs',
        ['log_id'], ['id']
    )
    op.create_foreign_key(
        'daily_log_activities_task_activity_id_fkey',
        'daily_log_activities', 'task_activities',
        ['task_activity_id'], ['id']
    )
