#!/bin/bash
# =============================================================
# Deploy Script - Chạy trên VPS (thủ công hoặc bởi GitHub Actions)
# Cách dùng: cd /opt/mattermost && bash scripts/deploy.sh
# =============================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

log_info()    { echo -e "${CYAN}[$(date '+%H:%M:%S')] INFO ${NC} $1"; }
log_success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] OK   ${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARN ${NC} $1"; }
log_error()   { echo -e "${RED}[$(date '+%H:%M:%S')] ERR  ${NC} $1"; exit 1; }

DEPLOY_PATH="${DEPLOY_PATH:-/opt/mattermost}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BRANCH="${DEPLOY_BRANCH:-develop}"
RELEASES_DIR="$DEPLOY_PATH/releases"
ENV_FILE="$DEPLOY_PATH/.env"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cd "$DEPLOY_PATH"

# ── Kiểm tra điều kiện ───────────────────────────────────────
[ -f "$ENV_FILE" ] || log_error "Không tìm thấy $ENV_FILE. Hãy tạo file .env trên VPS!"
[ -f "$COMPOSE_FILE" ] || log_error "Không tìm thấy $COMPOSE_FILE!"

# ── Lưu trạng thái hiện tại để rollback ─────────────────────
log_info "Lưu trạng thái hiện tại..."
mkdir -p "$RELEASES_DIR"
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "$CURRENT_COMMIT" > "$RELEASES_DIR/last_commit.txt"
echo "$TIMESTAMP" > "$RELEASES_DIR/last_deploy.txt"
log_info "Commit hiện tại: $CURRENT_COMMIT"

# ── Pull code mới nhất ───────────────────────────────────────
log_info "Pull code từ origin/$BRANCH..."
git fetch origin "$BRANCH" || log_error "Không thể fetch từ origin!"
git reset --hard "origin/$BRANCH"
NEW_COMMIT=$(git rev-parse --short HEAD)
log_success "Code đã cập nhật: $CURRENT_COMMIT → $NEW_COMMIT"

# ── Build & Deploy ───────────────────────────────────────────
log_info "Build và deploy với docker compose..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

log_success "Deploy containers đã khởi động"

# ── Kiểm tra containers đang chạy ────────────────────────────
log_info "Kiểm tra trạng thái containers..."
sleep 5
docker compose -f "$COMPOSE_FILE" ps

# ── Cleanup images cũ ────────────────────────────────────────
log_info "Dọn dẹp images cũ..."
docker image prune -f --filter "until=72h" || true
log_success "Cleanup hoàn tất"

# ── Ghi log deploy ───────────────────────────────────────────
cat >> "$RELEASES_DIR/deploy_history.log" << EOF
[$TIMESTAMP] Deploy thành công | $CURRENT_COMMIT → $NEW_COMMIT | Branch: $BRANCH
EOF

log_success "Deploy hoàn tất! ✅"
echo ""
echo "  Truy cập: http://$(hostname -I | awk '{print $1}'):8065"
echo "  Rollback: bash scripts/rollback.sh"
echo ""
