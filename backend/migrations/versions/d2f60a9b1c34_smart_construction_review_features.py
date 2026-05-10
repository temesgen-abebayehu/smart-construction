"""smart-construction review features: per-task budget+duration, daily-log
quantity_completed/unit, Labor→Manpower rename, daily_log_photos table.

Revision ID: d2f60a9b1c34
Revises: b9e3d175a248
Create Date: 2026-05-10 00:00:00.000000

Adds the schema changes that back the post-review feature additions:
  - tasks.budget                       (per-task allocated cost)
  - tasks.duration_days                (source of truth; end_date is auto-synced)
  - daily_logs.quantity_completed      ("how many" units of work done)
  - daily_logs.unit                    (e.g. m, m³, units)
  - rename labor → manpower            (terminology requested in review)
  - new table daily_log_photos         (picture attachments)

Defensive: this migration may run on a DB where main.py's lifespan ran
Base.metadata.create_all() before alembic, in which case `manpower` and
`daily_log_photos` already exist empty alongside the real `labor` table.
We detect that state and reconcile it instead of failing.

duration_days is backfilled from (end_date - start_date) for existing rows.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as SQL_UUID


# revision identifiers, used by Alembic.
revision: str = 'd2f60a9b1c34'
down_revision: Union[str, Sequence[str], None] = 'b9e3d175a248'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def _column_exists(inspector, table: str, column: str) -> bool:
    if not _table_exists(inspector, table):
        return False
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── Task: budget + duration ──
    if not _column_exists(inspector, "tasks", "budget"):
        op.add_column("tasks", sa.Column("budget", sa.Float(), nullable=True, server_default="0"))
    if not _column_exists(inspector, "tasks", "duration_days"):
        op.add_column("tasks", sa.Column("duration_days", sa.Integer(), nullable=True))

    # Backfill duration_days from existing start/end dates.
    op.execute("""
        UPDATE tasks
        SET duration_days = GREATEST(0, EXTRACT(DAY FROM (end_date - start_date))::int)
        WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND duration_days IS NULL
    """)

    # ── DailyLog: "how many" + unit ──
    if not _column_exists(inspector, "daily_logs", "quantity_completed"):
        op.add_column("daily_logs", sa.Column("quantity_completed", sa.Float(), nullable=True))
    if not _column_exists(inspector, "daily_logs", "unit"):
        op.add_column("daily_logs", sa.Column("unit", sa.String(length=50), nullable=True))

    # ── labor → manpower ──
    has_labor = _table_exists(inspector, "labor")
    has_manpower = _table_exists(inspector, "manpower")

    if has_labor and has_manpower:
        # Common dev case: server's create_all built an empty `manpower`
        # alongside the real `labor`. Drop the empty one and rename labor.
        manpower_count = bind.execute(sa.text("SELECT COUNT(*) FROM manpower")).scalar()
        if manpower_count and manpower_count > 0:
            raise RuntimeError(
                "Both 'labor' and 'manpower' tables hold rows. Manual merge required "
                "before this migration can run."
            )
        op.drop_table("manpower")
        op.rename_table("labor", "manpower")
    elif has_labor:
        op.rename_table("labor", "manpower")
    elif not has_manpower:
        # Neither exists — first-time bootstrap. Create manpower from scratch.
        op.create_table(
            "manpower",
            sa.Column("id", SQL_UUID(as_uuid=True), primary_key=True),
            sa.Column("log_id", SQL_UUID(as_uuid=True), sa.ForeignKey("daily_logs.id"), nullable=False),
            sa.Column("worker_type", sa.String(length=100)),
            sa.Column("hours_worked", sa.Float()),
            sa.Column("cost", sa.Float()),
        )
        op.create_index("ix_manpower_id", "manpower", ["id"])
    # else: only manpower exists — already renamed elsewhere, nothing to do.

    # ── DailyLogPhoto ──
    if not _table_exists(inspector, "daily_log_photos"):
        op.create_table(
            "daily_log_photos",
            sa.Column("id", SQL_UUID(as_uuid=True), primary_key=True),
            sa.Column("log_id", SQL_UUID(as_uuid=True), sa.ForeignKey("daily_logs.id"), nullable=False),
            sa.Column("file_path", sa.String(length=500), nullable=False),
            sa.Column("url_path", sa.String(length=500), nullable=False),
            sa.Column("original_filename", sa.String(length=255), nullable=True),
            sa.Column("content_type", sa.String(length=100), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=True),
            sa.Column("uploaded_by_id", SQL_UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_daily_log_photos_id", "daily_log_photos", ["id"])
        op.create_index("ix_daily_log_photos_log_id", "daily_log_photos", ["log_id"])
    else:
        # create_all may have built the table without our ix_*_log_id index.
        existing_index_names = {ix["name"] for ix in inspector.get_indexes("daily_log_photos")}
        if "ix_daily_log_photos_log_id" not in existing_index_names:
            op.create_index("ix_daily_log_photos_log_id", "daily_log_photos", ["log_id"])


def downgrade() -> None:
    op.drop_index("ix_daily_log_photos_log_id", table_name="daily_log_photos")
    op.execute("DROP INDEX IF EXISTS ix_daily_log_photos_id")
    op.drop_table("daily_log_photos")

    op.rename_table("manpower", "labor")

    op.drop_column("daily_logs", "unit")
    op.drop_column("daily_logs", "quantity_completed")

    op.drop_column("tasks", "duration_days")
    op.drop_column("tasks", "budget")
