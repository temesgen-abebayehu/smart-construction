#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Running migrations..."
alembic upgrade head

echo "Starting FastAPI with Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
