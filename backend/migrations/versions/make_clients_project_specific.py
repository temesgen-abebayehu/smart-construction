"""make_clients_project_specific

Revision ID: client_project_002
Revises: stakeholder_project_001
Create Date: 2026-05-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'client_project_002'
down_revision = 'stakeholder_project_001'
branch_labels = None
depends_on = None


def upgrade():
    # Step 1: Add project_id column to clients table (nullable first)
    op.add_column('clients', sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Step 2: Migrate existing data - copy project's client_id relationship to client's project_id
    # For each client, find the project that references it and set the client's project_id
    op.execute("""
        UPDATE clients 
        SET project_id = projects.id 
        FROM projects 
        WHERE projects.client_id = clients.id
    """)
    
    # Step 3: Make project_id NOT NULL now that data is migrated
    op.alter_column('clients', 'project_id', nullable=False)
    
    # Step 4: Create index and foreign key for clients.project_id
    op.create_index(op.f('ix_clients_project_id'), 'clients', ['project_id'], unique=False)
    op.create_foreign_key('fk_clients_project_id', 'clients', 'projects', ['project_id'], ['id'], ondelete='CASCADE')
    
    # Step 5: Drop the old client_id column from projects table
    op.drop_constraint('projects_client_id_fkey', 'projects', type_='foreignkey')
    op.drop_index('ix_projects_client_id', table_name='projects')
    op.drop_column('projects', 'client_id')
    
    # Step 6: Drop the contractors table (no longer needed)
    op.drop_table('contractors')


def downgrade():
    # Recreate contractors table
    op.create_table('contractors',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('company_name', sa.String(200), nullable=False),
        sa.Column('tin_number', sa.String(20), nullable=True),
        sa.Column('license_number', sa.String(100), nullable=True),
        sa.Column('address', sa.String(300), nullable=True),
        sa.Column('contact_phone', sa.String(20), nullable=True),
        sa.Column('contact_email', sa.String(150), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='fk_contractors_project_id')
    )
    op.create_index('ix_contractors_id', 'contractors', ['id'], unique=False)
    op.create_index('ix_contractors_project_id', 'contractors', ['project_id'], unique=False)
    
    # Add back client_id to projects
    op.add_column('projects', sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_projects_client_id', 'projects', ['client_id'], unique=False)
    op.create_foreign_key('projects_client_id_fkey', 'projects', 'clients', ['client_id'], ['id'])
    
    # Migrate data back - set project's client_id to the first client with matching project_id
    op.execute("""
        UPDATE projects 
        SET client_id = (
            SELECT id FROM clients 
            WHERE clients.project_id = projects.id 
            LIMIT 1
        )
    """)
    
    # Remove project_id from clients
    op.drop_constraint('fk_clients_project_id', 'clients', type_='foreignkey')
    op.drop_index(op.f('ix_clients_project_id'), table_name='clients')
    op.drop_column('clients', 'project_id')
