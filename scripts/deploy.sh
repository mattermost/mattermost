#!/bin/bash
# =============================================================
# Deploy Script - Chạy trên VPS bởi GitHub Actions
# Không chạy trực tiếp tay trừ khi hiểu rõ tác động
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
RELEASES_DIR="$DEPLOY_PATH/releases"
ENV_FILE="$DEPLOY_PATH/.env"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ── Kiểm tra điều kiện ───────────────────────────────────────
[ -f "$ENV_FILE" ] || log_error "Không tìm thấy $ENV_FILE. Hãy tạo file .env trên VPS!"

# ── Lưu version hiện tại để rollback ────────────────────────
log_info "Lưu trạng thái hiện tại..."
mkdir -p "$RELEASES_DIR"

# Lưu image ID hiện tại
CURRENT_IMAGE=$(docker inspect --format='{{.Config.Image}}' mattermost-app 2>/dev/null || echo "none")
echo "$CURRENT_IMAGE" > "$RELEASES_DIR/last_image.txt"
echo "$TIMESTAMP" > "$RELEASES_DIR/last_deploy.txt"
log_info "Phiên bản hiện tại: $CURRENT_IMAGE"

# ── Pull image mới nhất ───────────────────────────────────────
log_info "Pull Mattermost image mới nhất..."
MM_VERSION=$(grep 'MM_VERSION=' "$ENV_FILE" | cut -d'=' -f2 | tr -d ' ')
MM_VERSION="${MM_VERSION:-latest}"
docker pull "mattermost/mattermost-team-edition:${MM_VERSION}" || log_error "Không thể pull image!"
log_success "Pull image hoàn tất: mattermost-team-edition:${MM_VERSION}"

# ── Deploy ───────────────────────────────────────────────────
log_info "Đang deploy với docker compose..."
cd "$DEPLOY_PATH"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --pull always

log_success "Deploy containers đã khởi động"

# ── Kiểm tra containers đang chạy ────────────────────────────
log_info "Kiểm tra trạng thái containers..."
sleep 5
docker compose -f "$COMPOSE_FILE" ps

# ── Cleanup images cũ (giữ lại 3 images) ────────────────────
log_info "Dọn dẹp images cũ..."
docker image prune -f --filter "until=72h" || true
log_success "Cleanup hoàn tất"

# ── Ghi log deploy ───────────────────────────────────────────
cat >> "$RELEASES_DIR/deploy_history.log" << EOF
[$TIMESTAMP] Deploy thành công | Image: mattermost-team-edition:${MM_VERSION} | Prev: $CURRENT_IMAGE
EOF

log_success "Deploy hoàn tất! ✅"
