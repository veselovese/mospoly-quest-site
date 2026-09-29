#!/bin/sh
set -eu

case "${1:-}" in
  staging)    SERVICE=frontend-stage ;;
  production) SERVICE=frontend-prod ;;
  *) echo "unknown environment"; exit 1 ;;
esac

cd /opt/quest
docker compose pull "$SERVICE"
docker compose up -d caddy "$SERVICE"
docker image prune -f
echo "deployed $SERVICE"
