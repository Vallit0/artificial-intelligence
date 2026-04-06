#!/bin/bash
# ==============================================
# Setup script — installs the deploy cron job
# Run this ONCE on the server
# Usage: ./setup-cron.sh [interval_minutes]
# ==============================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT="$REPO_DIR/deploy.sh"
INTERVAL="${1:-2}"  # Default: every 2 minutes

# Make deploy script executable
chmod +x "$DEPLOY_SCRIPT"

# Build cron expression
CRON_ENTRY="*/$INTERVAL * * * * $DEPLOY_SCRIPT >> $REPO_DIR/deploy.log 2>&1"

# Remove any existing entry for this repo, then add new one
(crontab -l 2>/dev/null | grep -v "$DEPLOY_SCRIPT" || true; echo "$CRON_ENTRY") | crontab -

echo "Cron job installed! Checking every $INTERVAL minutes."
echo "Entry: $CRON_ENTRY"
echo ""
echo "Useful commands:"
echo "  View logs:    tail -f $REPO_DIR/deploy.log"
echo "  View cron:    crontab -l"
echo "  Remove cron:  crontab -l | grep -v '$DEPLOY_SCRIPT' | crontab -"
