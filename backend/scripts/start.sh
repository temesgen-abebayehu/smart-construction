#!/bin/bash

# Run migrations
echo "Running migrations..."
alembic upgrade head

# Start the application
echo "Starting FastAPI..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
