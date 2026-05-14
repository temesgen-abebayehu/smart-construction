"""fix_stakeholders_schema

Revision ID: fix_stakeholders_001
Revises: stakeholder_project_001
Create Date: 2026-05-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'fix_stakeholders_001'
down_revision = 'stakeholder_project_001'
branch_labels = None
depends_on = None


def upgrade():
    # Check and add columns only if they don't exist
    conn = op.get_bind()
    
    # Add project_id to contractors if not exists
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='contractors' AND column_name='project_id'
    """))
    if not result.fetchone():
        op.add_column('contractors', sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_index(op.f('ix_contractors_project_id'), 'contractors', ['project_id'], unique=False)
        op.create_foreign_key('fk_contractors_project_id', 'contractors', 'projects', ['project_id'], ['id'])
    
    # Add project_id to suppliers if not exists
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='suppliers' AND column_name='project_id'
    """))
    if not result.fetchone():
        op.add_column('suppliers', sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True))
        op.create_index(op.f('ix_suppliers_project_id'), 'suppliers', ['project_id'], unique=False)
        op.create_foreign_key('fk_suppliers_project_id', 'suppliers', 'projects', ['project_id'], ['id'])
    
    # Update Client fields
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='clients' AND column_name='tin_number'
    """))
    if not result.fetchone():
        op.add_column('clients', sa.Column('tin_number', sa.String(20), nullable=True))
        op.add_column('clients', sa.Column('address', sa.String(300), nullable=True))
        op.add_column('clients', sa.Column('contact_phone', sa.String(20), nullable=True))
    
    # Update Contractor fields
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='contractors' AND column_name='company_name'
    """))
    if not result.fetchone():
        op.add_column('contractors', sa.Column('company_name', sa.String(200), nullable=True))
        op.add_column('contractors', sa.Column('tin_number', sa.String(20), nullable=True))
        op.add_column('contractors', sa.Column('license_number', sa.String(100), nullable=True))
        op.add_column('contractors', sa.Column('address', sa.String(300), nullable=True))
        op.add_column('contractors', sa.Column('contact_phone', sa.String(20), nullable=True))
        op.add_column('contractors', sa.Column('contact_email', sa.String(150), nullable=True))
        
        # Copy name to company_name
        op.execute("UPDATE contractors SET company_name = name WHERE company_name IS NULL")
        
        # Make company_name not nullable
        op.alter_column('contractors', 'company_name', nullable=False)
        
        # Drop old name column
        op.drop_column('contractors', 'name')
    
    # Update Supplier fields
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='suppliers' AND column_name='role'
    """))
    if not result.fetchone():
        op.add_column('suppliers', sa.Column('role', sa.String(100), nullable=True))
        op.add_column('suppliers', sa.Column('tin_number', sa.String(20), nullable=True))
        op.add_column('suppliers', sa.Column('address', sa.String(300), nullable=True))
        op.add_column('suppliers', sa.Column('contact_email', sa.String(150), nullable=True))
        op.add_column('suppliers', sa.Column('contact_phone', sa.String(20), nullable=True))


def downgrade():
    pass  # Not implementing downgrade for safety
