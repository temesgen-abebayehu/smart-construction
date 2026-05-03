FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Install curl for downloading the ML model from GitHub releases.
# python:3.11-slim does not include curl by default.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies (separate layer so it's cached unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the ML model from GitHub Releases.
# The pkl exceeds GitHub's 100 MB single-file push limit, so it lives as a release asset.
# This layer is cached unless this RUN command itself changes (e.g., URL update).
RUN mkdir -p ml && \
    curl -L -f -o ml/rf_classifier.pkl \
    "https://github.com/temesgen-abebayehu/smart-construction/releases/download/model-v1.0/rf_classifier.pkl"

# Copy project source
COPY . .

# Make scripts executable
RUN chmod +x build.sh start.sh

# Run migrations + uvicorn (defined in start.sh)
CMD ["./start.sh"]
