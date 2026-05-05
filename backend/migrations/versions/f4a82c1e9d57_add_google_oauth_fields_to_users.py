"""add google oauth fields to users

Revision ID: f4a82c1e9d57
Revises: 6de7c29a0beb
Create Date: 2026-05-06 00:00:00.000000

Adds google_id, auth_provider columns to users and makes hashed_password
nullable so users registered via Google Sign-In can exist without a password.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a82c1e9d57'
down_revision: Union[str, Sequence[str], None] = '6de7c29a0beb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('google_id', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('auth_provider', sa.String(length=32), server_default='local', nullable=False))
    op.create_index('ix_users_google_id', 'users', ['google_id'], unique=True)
    op.alter_column('users', 'hashed_password', existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    # Restore NOT NULL on hashed_password. If any Google-only users exist
    # at downgrade time, this will fail — clean them up first.
    op.alter_column('users', 'hashed_password', existing_type=sa.String(length=255), nullable=False)
    op.drop_index('ix_users_google_id', table_name='users')
    op.drop_column('users', 'auth_provider')
    op.drop_column('users', 'google_id')
