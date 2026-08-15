FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OAUTHLIB_INSECURE_TRANSPORT=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY run.py .
COPY app ./app

# Writable runtime dirs (scratch logs, template attachments, OAuth token).
# Volumes in docker-compose keep these across restarts.
RUN mkdir -p /app/scratch /app/attachments /app/data

EXPOSE 8000

# Single worker: the app runs in-process background threads (IMAP loop, follow-ups).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
