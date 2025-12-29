# Backend-only image (minimal - deps installed at runtime)
FROM python:3.12-slim

WORKDIR /app

# Install runtime dependencies for OpenCV and git (needed for CLIP install)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy application code
COPY app/ ./app/
COPY cards/ ./cards/
COPY requirements.txt ./requirements.txt

# Copy entrypoint script from parent
COPY ../entrypoint.sh ./entrypoint.sh 2>/dev/null || true
RUN chmod +x ./entrypoint.sh 2>/dev/null || true

# Create directories for runtime caches and data
RUN mkdir -p /app/deps /app/embeddings /app/data /root/.cache/clip

# SQLite database will be stored in /app/data (mount as volume for persistence)
VOLUME /app/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health')" || exit 1

# Default: direct start (assumes deps pre-installed or use entrypoint.sh)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
