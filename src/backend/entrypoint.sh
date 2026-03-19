#!/bin/sh
set -e

echo "==> Running migrations..."
python manage.py makemigrations --noinput
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput 2>/dev/null || true

echo "==> Ensuring reports directory exists..."
mkdir -p "${DATA_FOLDER:-/app/data/reports}"

echo "==> Starting file watcher in background..."
python /app/watch_reports.py &

echo "==> Starting gunicorn on :8000"
exec gunicorn notify.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -