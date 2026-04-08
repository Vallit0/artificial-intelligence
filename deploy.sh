#!/bin/bash
# ==============================================
# Auto-deploy script (pull-based CI/CD)
# Runs via cron — pulls main, rebuilds if changed
# ==============================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="develop"
LOG_FILE="$REPO_DIR/deploy.log"
COMPOSE_FILE="$REPO_DIR/docker-compose.yml"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cd "$REPO_DIR"

# Fetch latest changes from remote
git fetch origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"

# Compare local and remote
LOCAL=$(git rev-parse "$BRANCH" 2>/dev/null || echo "none")
REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "none")

if [ "$LOCAL" = "$REMOTE" ]; then
  log "No changes detected. Skipping deploy."
  exit 0
fi

log "Changes detected: $LOCAL -> $REMOTE"
log "Pulling latest changes..."

git checkout "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
git pull origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"

log "Rebuilding and restarting containers..."
docker compose -f "$COMPOSE_FILE" build --no-cache app 2>&1 | tee -a "$LOG_FILE"
docker compose -f "$COMPOSE_FILE" up -d 2>&1 | tee -a "$LOG_FILE"

# Cleanup old images
docker image prune -f 2>&1 | tee -a "$LOG_FILE"

log "Deploy complete! Now running: $(git rev-parse --short HEAD)"
