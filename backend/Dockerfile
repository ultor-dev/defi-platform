FROM python:3.12-slim

WORKDIR /app

# Системные зависимости (нужны для cryptography и psycopg2)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install resend==2.4.0
COPY . .

EXPOSE 8000
