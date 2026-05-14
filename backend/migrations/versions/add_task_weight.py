"""add_task_weight

Revision ID: task_weight_001
Revises: client_project_002
Create Date: 2026-05-14

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'task_weight_001'
down_revision = 'client_project_002'
branch_labels = None
depends_on = None


def upgrade():
    # Add weight column to tasks table with default value of 0.0
    # Weight represents task importance as percentage (0-100), must sum to 100% across all tasks
    op.add_column('tasks', sa.Column('weight', sa.Float(), nullable=False, server_default='0.0'))


def downgrade():
    # Remove weight column from tasks table
    op.drop_column('tasks', 'weight')
