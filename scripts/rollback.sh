#!/bin/bash
# =============================================================
# Rollback Script - Quay về commit trước đó
# Cách dùng: bash scripts/rollback.sh
# =============================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

log_info()    { echo -e "${CYAN}[$(date '+%H:%M:%S')] INFO ${NC} $1"; }
log_success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] OK   ${NC} $1"; }
log_error()   { echo -e "${RED}[$(date '+%H:%M:%S')] ERR  ${NC} $1"; exit 1; }

DEPLOY_PATH="${DEPLOY_PATH:-/opt/mattermost}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
RELEASES_DIR="$DEPLOY_PATH/releases"
ENV_FILE="$DEPLOY_PATH/.env"

cd "$DEPLOY_PATH"

# ── Kiểm tra điều kiện ───────────────────────────────────────
[ -f "$ENV_FILE" ]   || log_error "Không tìm thấy $ENV_FILE!"
[ -d "$RELEASES_DIR" ] || log_error "Không tìm thấy thư mục releases!"

LAST_COMMIT_FILE="$RELEASES_DIR/last_commit.txt"
[ -f "$LAST_COMMIT_FILE" ] || log_error "Không có thông tin commit để rollback!"

PREV_COMMIT=$(cat "$LAST_COMMIT_FILE")
CURRENT_COMMIT=$(git rev-parse --short HEAD)

log_info "Commit hiện tại: $CURRENT_COMMIT"
log_info "Rollback về: $PREV_COMMIT"

# ── Rollback code ────────────────────────────────────────────
git checkout "$PREV_COMMIT"

# ── Rebuild & restart ────────────────────────────────────────
log_info "Rebuild và restart containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

sleep 10
docker compose -f "$COMPOSE_FILE" ps

# ── Ghi log ──────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cat >> "$RELEASES_DIR/deploy_history.log" << EOF
[$TIMESTAMP] ROLLBACK | $CURRENT_COMMIT → $PREV_COMMIT
EOF

log_success "Rollback hoàn tất! ✅"
