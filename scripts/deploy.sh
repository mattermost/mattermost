#!/usr/bin/env bash
# ============================================================
# deploy.sh — Deploy Mattermost tu source (Git-based)
#
# Flow CI:
#   1. CI build webapp → SCP webapp-dist.tar.gz len /tmp/
#   2. VPS: git pull → giai nen webapp → docker compose build (Go only)
#
# Su dung:
#   bash scripts/deploy.sh
# ============================================================
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/mattermost}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-develop}"
COMPOSE_FILE="docker-compose.prod.yml"
WEBAPP_ARTIFACT="/tmp/webapp-dist.tar.gz"

log() { echo "[$(date +%H:%M:%S)] $1  $2"; }

cd "$DEPLOY_PATH" || exit 1

# -- 1. Luu trang thai hien tai
log "INFO" "Luu trang thai hien tai..."
PREV_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
log "INFO" "Commit hien tai: $PREV_COMMIT"

# -- 2. Pull code moi nhat
log "INFO" "Pull code tu origin/$DEPLOY_BRANCH..."
git fetch origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"

NEW_COMMIT=$(git rev-parse --short HEAD)
log "INFO" "Commit moi: $NEW_COMMIT"

# -- 3. Giai nen webapp pre-built tu CI
WEBAPP_DIST="$DEPLOY_PATH/webapp/channels/dist"
if [ -f "$WEBAPP_ARTIFACT" ]; then
    log "INFO" "Giai nen webapp pre-built tu CI..."
    rm -rf "$WEBAPP_DIST"
    mkdir -p "$WEBAPP_DIST"
    tar xzf "$WEBAPP_ARTIFACT" -C "$WEBAPP_DIST"
    rm -f "$WEBAPP_ARTIFACT"
    log "INFO" "Webapp giai nen thanh cong"
else
    log "WARN" "Khong tim thay $WEBAPP_ARTIFACT — dung webapp co san"
    if [ ! -d "$WEBAPP_DIST" ]; then
        log "ERROR" "Khong co webapp dist! Can chay CI build truoc."
        exit 1
    fi
fi

# -- Debug: kiem tra webapp dist
log "INFO" "Kiem tra webapp dist..."
if [ -d "$WEBAPP_DIST" ]; then
    FILE_COUNT=$(find "$WEBAPP_DIST" -type f 2>/dev/null | wc -l)
    log "INFO" "Webapp dist: $FILE_COUNT files"
else
    log "ERROR" "Webapp dist directory khong ton tai!"
    exit 1
fi

# -- 4. Build va deploy voi Docker Compose
log "INFO" "Build va deploy voi docker compose..."
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans 2>&1

# -- 5. Kiem tra container status
sleep 5
log "INFO" "Kiem tra container..."
docker compose -f "$COMPOSE_FILE" ps

# -- 6. Luu thong tin deploy
mkdir -p "$DEPLOY_PATH/releases"
echo "$PREV_COMMIT" > "$DEPLOY_PATH/releases/last_commit.txt"
log "INFO" "=== Deploy hoan tat ==="
log "INFO" "  Tu: $PREV_COMMIT -> $NEW_COMMIT"
log "INFO" "  Rollback: bash scripts/rollback.sh"
