#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Running migrations..."
alembic upgrade head

# Download the ML model from GitHub Releases if not already present.
# The model is too large to commit (>100 MB GitHub limit), so it lives as a release asset.
MODEL_URL="https://github.com/temesgen-abebayehu/smart-construction/releases/download/model-v1.0/rf_classifier.pkl"
MODEL_PATH="ml/rf_classifier.pkl"
if [ ! -f "$MODEL_PATH" ]; then
  echo "Downloading ML model from $MODEL_URL..."
  mkdir -p ml
  curl -L -f -o "$MODEL_PATH" "$MODEL_URL"
  echo "ML model downloaded ($(stat -c%s "$MODEL_PATH" 2>/dev/null || stat -f%z "$MODEL_PATH") bytes)."
else
  echo "ML model already present at $MODEL_PATH."
fi
