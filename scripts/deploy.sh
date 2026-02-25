#!/usr/bin/env bash
# ============================================================
# deploy.sh — Deploy Mattermost từ source (Git-based)
#
# Flow CI:
#   1. CI build webapp → SCP webapp-dist.tar.gz lên /tmp/
#   2. VPS: git pull → giải nén webapp → docker compose build (Go only)
#
# Sử dụng:
#   bash scripts/deploy.sh
# ============================================================
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/mattermost}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-develop}"
COMPOSE_FILE="docker-compose.prod.yml"
WEBAPP_ARTIFACT="/tmp/webapp-dist.tar.gz"

log() { echo "[$(date +%H:%M:%S)] $1  $2"; }

cd "$DEPLOY_PATH" || exit 1

# ── 1. Lưu trạng thái hiện tại ──────────────────────────────
log "INFO" "Lưu trạng thái hiện tại..."
PREV_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
log "INFO" "Commit hiện tại: $PREV_COMMIT"

# ── 2. Pull code mới nhất ───────────────────────────────────
log "INFO" "Pull code từ origin/$DEPLOY_BRANCH..."
git fetch origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"

NEW_COMMIT=$(git rev-parse --short HEAD)
log "INFO" "Commit mới: $NEW_COMMIT"

# ── 3. Giải nén webapp pre-built từ CI ──────────────────────
WEBAPP_DIST="$DEPLOY_PATH/webapp/channels/dist"
if [ -f "$WEBAPP_ARTIFACT" ]; then
    log "INFO" "Giải nén webapp pre-built từ CI..."
    # Xóa dist cũ (nếu có) để tránh file thừa
    rm -rf "$WEBAPP_DIST"
    mkdir -p "$WEBAPP_DIST"
    tar xzf "$WEBAPP_ARTIFACT" -C "$WEBAPP_DIST"
    rm -f "$WEBAPP_ARTIFACT"
    log "INFO" "Webapp giải nén thành công → $WEBAPP_DIST"
else
    log "WARN" "Không tìm thấy $WEBAPP_ARTIFACT — dùng webapp có sẵn"
    if [ ! -d "$WEBAPP_DIST" ]; then
        log "ERROR" "Không có webapp dist! Cần chạy CI build trước."
        exit 1
    fi
fi

# ── Debug: kiểm tra webapp dist ─────────────────────────────
log "INFO" "Kiểm tra webapp dist..."
if [ -d "$WEBAPP_DIST" ]; then
    FILE_COUNT=$(find "$WEBAPP_DIST" -type f | wc -l)
    log "INFO" "Webapp dist: $FILE_COUNT files"
    ls -la "$WEBAPP_DIST/" | head -10 || true
else
    log "ERROR" "Webapp dist directory không tồn tại sau extraction!"
    exit 1
fi

# ── 4. Build và deploy với Docker Compose ────────────────────
log "INFO" "Build và deploy với docker compose..."
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans 2>&1

# ── 5. Kiểm tra container status ────────────────────────────
sleep 5
log "INFO" "Kiểm tra container..."
docker compose -f "$COMPOSE_FILE" ps

# ── 6. Lưu thông tin deploy ─────────────────────────────────
mkdir -p "$DEPLOY_PATH/releases"
echo "$PREV_COMMIT" > "$DEPLOY_PATH/releases/last_commit.txt"
log "INFO" "=== Deploy hoàn tất ==="
log "INFO" "  Từ: $PREV_COMMIT → $NEW_COMMIT"
log "INFO" "  Rollback: bash scripts/rollback.sh"
