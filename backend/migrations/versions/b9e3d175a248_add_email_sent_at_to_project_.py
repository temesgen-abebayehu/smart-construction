"""add email_sent_at to project_invitations

Revision ID: b9e3d175a248
Revises: 5a7b5d4f7467
Create Date: 2026-05-07 00:00:00.000000

Tracks when an invitation email was successfully sent. The atomic create
flow guarantees this is set for every newly-persisted row; old rows from
before this migration may have NULL.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9e3d175a248'
down_revision: Union[str, Sequence[str], None] = '5a7b5d4f7467'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'project_invitations',
        sa.Column('email_sent_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('project_invitations', 'email_sent_at')
