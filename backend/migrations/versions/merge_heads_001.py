"""merge migration heads

Revision ID: merge_heads_001
Revises: fix_stakeholders_001, task_weight_001
Create Date: 2026-05-14

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'merge_heads_001'
down_revision = ('fix_stakeholders_001', 'task_weight_001')
branch_labels = None
depends_on = None


def upgrade():
    # This is a merge migration - no schema changes needed
    pass


def downgrade():
    # This is a merge migration - no schema changes needed
    pass
