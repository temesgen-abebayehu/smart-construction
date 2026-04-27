"""add unique constraint to clients.name

Revision ID: c7d2a4e91b38
Revises: a3e1f8b29c47
Create Date: 2026-04-27 00:01:00.000000

Adds a unique index on clients.name so that no two clients can share
the same name, even if their emails differ.

NOTE: If the existing `clients` table contains duplicate names, this
migration will fail. Resolve duplicates (merge or rename) before running.
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c7d2a4e91b38'
down_revision: Union[str, Sequence[str], None] = 'a3e1f8b29c47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_clients_name', 'clients', ['name'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_clients_name', table_name='clients')
