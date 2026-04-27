"""add unique constraint to clients.contact_email

Revision ID: a3e1f8b29c47
Revises: 74ba722102ce
Create Date: 2026-04-27 00:00:00.000000

Adds a unique index on clients.contact_email so the find-or-create-by-email
flow used during project creation is race-safe at the DB level.

NOTE: If the existing `clients` table contains duplicate non-NULL emails,
this migration will fail. Resolve duplicates first (merge or rename) before
running. NULL emails are allowed and treated as distinct in PostgreSQL.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a3e1f8b29c47'
down_revision: Union[str, Sequence[str], None] = '74ba722102ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(
        'ix_clients_contact_email',
        'clients',
        ['contact_email'],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_clients_contact_email', table_name='clients')
