FROM python:3.12-slim

# uv for dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app
ENV UV_LINK_MODE=copy \
    DATA_DIR=/app/data \
    SANDBOX_DIR=/app/sandbox

# Install deps first (better layer caching)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# App code
COPY app ./app

EXPOSE 8000
CMD ["uv", "run", "--no-dev", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
