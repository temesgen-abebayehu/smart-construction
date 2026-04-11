#!/bin/bash

# Exit on error
set -e

echo "Building the Docker image..."
docker build -t smart-construction-backend .

echo "Build complete! You can run the app using: docker-compose up"
