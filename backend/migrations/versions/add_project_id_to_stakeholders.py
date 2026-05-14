"""add_project_id_to_stakeholders

Revision ID: stakeholder_project_001
Revises: f9a3b2c1d4e5, 924982cebe5a
Create Date: 2026-05-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'stakeholder_project_001'
down_revision = ('f9a3b2c1d4e5', '924982cebe5a')
branch_labels = None
depends_on = None


def upgrade():
    # Add project_id column to contractors table
    op.add_column('contractors', sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_contractors_project_id'), 'contractors', ['project_id'], unique=False)
    op.create_foreign_key('fk_contractors_project_id', 'contractors', 'projects', ['project_id'], ['id'])
    
    # Add project_id column to suppliers table
    op.add_column('suppliers', sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_suppliers_project_id'), 'suppliers', ['project_id'], unique=False)
    op.create_foreign_key('fk_suppliers_project_id', 'suppliers', 'projects', ['project_id'], ['id'])
    
    # Update Client model fields (remove unique constraints, adjust lengths)
    op.drop_constraint('clients_name_key', 'clients', type_='unique')
    op.drop_constraint('clients_contact_email_key', 'clients', type_='unique')
    op.alter_column('clients', 'name', type_=sa.String(200), existing_type=sa.String(255))
    op.alter_column('clients', 'contact_email', type_=sa.String(150), existing_type=sa.String(255))
    op.add_column('clients', sa.Column('tin_number', sa.String(20), nullable=True))
    op.add_column('clients', sa.Column('address', sa.String(300), nullable=True))
    op.add_column('clients', sa.Column('contact_phone', sa.String(20), nullable=True))
    
    # Update Contractor model fields
    op.add_column('contractors', sa.Column('company_name', sa.String(200), nullable=True))
    op.add_column('contractors', sa.Column('tin_number', sa.String(20), nullable=True))
    op.add_column('contractors', sa.Column('license_number', sa.String(100), nullable=True))
    op.add_column('contractors', sa.Column('address', sa.String(300), nullable=True))
    op.add_column('contractors', sa.Column('contact_phone', sa.String(20), nullable=True))
    op.add_column('contractors', sa.Column('contact_email', sa.String(150), nullable=True))
    
    # Copy name to company_name for contractors
    op.execute("UPDATE contractors SET company_name = name WHERE company_name IS NULL")
    
    # Drop old name column from contractors
    op.drop_column('contractors', 'name')
    
    # Make company_name not nullable
    op.alter_column('contractors', 'company_name', nullable=False)
    
    # Update Supplier model fields
    op.alter_column('suppliers', 'name', type_=sa.String(200), existing_type=sa.String(255))
    op.add_column('suppliers', sa.Column('role', sa.String(100), nullable=True))
    op.add_column('suppliers', sa.Column('tin_number', sa.String(20), nullable=True))
    op.add_column('suppliers', sa.Column('address', sa.String(300), nullable=True))
    op.add_column('suppliers', sa.Column('contact_email', sa.String(150), nullable=True))
    op.add_column('suppliers', sa.Column('contact_phone', sa.String(20), nullable=True))


def downgrade():
    # Revert Supplier changes
    op.drop_column('suppliers', 'contact_phone')
    op.drop_column('suppliers', 'contact_email')
    op.drop_column('suppliers', 'address')
    op.drop_column('suppliers', 'tin_number')
    op.drop_column('suppliers', 'role')
    op.alter_column('suppliers', 'name', type_=sa.String(255), existing_type=sa.String(200))
    
    # Revert Contractor changes
    op.add_column('contractors', sa.Column('name', sa.String(255), nullable=True))
    op.execute("UPDATE contractors SET name = company_name WHERE name IS NULL")
    op.alter_column('contractors', 'name', nullable=False)
    op.drop_column('contractors', 'contact_email')
    op.drop_column('contractors', 'contact_phone')
    op.drop_column('contractors', 'address')
    op.drop_column('contractors', 'license_number')
    op.drop_column('contractors', 'tin_number')
    op.drop_column('contractors', 'company_name')
    
    # Revert Client changes
    op.drop_column('clients', 'contact_phone')
    op.drop_column('clients', 'address')
    op.drop_column('clients', 'tin_number')
    op.alter_column('clients', 'contact_email', type_=sa.String(255), existing_type=sa.String(150))
    op.alter_column('clients', 'name', type_=sa.String(255), existing_type=sa.String(200))
    op.create_unique_constraint('clients_contact_email_key', 'clients', ['contact_email'])
    op.create_unique_constraint('clients_name_key', 'clients', ['name'])
    
    # Remove project_id from suppliers
    op.drop_constraint('fk_suppliers_project_id', 'suppliers', type_='foreignkey')
    op.drop_index(op.f('ix_suppliers_project_id'), table_name='suppliers')
    op.drop_column('suppliers', 'project_id')
    
    # Remove project_id from contractors
    op.drop_constraint('fk_contractors_project_id', 'contractors', type_='foreignkey')
    op.drop_index(op.f('ix_contractors_project_id'), table_name='contractors')
    op.drop_column('contractors', 'project_id')
