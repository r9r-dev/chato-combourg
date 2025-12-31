# Frontend build stage
FROM node:24-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Production stage (minimal - deps installed at runtime)
FROM python:3.12-slim

WORKDIR /app

# Install runtime dependencies for OpenCV, git, and fonts for image annotation
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    git \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Copy application code
COPY backend/app/ ./app/
COPY backend/cards/ ./cards/
COPY backend/requirements.txt ./requirements.txt

# Copy frontend build
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Copy Ultralytics config (disables telemetry and analytics)
COPY config/ultralytics/settings.json /root/.config/Ultralytics/settings.json

# Create directories for runtime data (mounted as volumes)
RUN mkdir -p /app/deps /app/models /app/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health')" || exit 1

ENTRYPOINT ["./entrypoint.sh"]
