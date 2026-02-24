#!/bin/bash
# =============================================================
# Rollback Script - Chạy trên VPS bởi GitHub Actions hoặc thủ công
#
# Cách dùng:
#   bash rollback.sh [số_bước]   (mặc định: 1)
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
STEPS="${1:-1}"

log_info "====== BẮT ĐẦU ROLLBACK (${STEPS} bước) ======"

# ── Kiểm tra điều kiện ───────────────────────────────────────
[ -f "$ENV_FILE" ]   || log_error "Không tìm thấy $ENV_FILE!"
[ -d "$RELEASES_DIR" ] || log_error "Không tìm thấy thư mục releases!"

# ── Đọc image trước đó ───────────────────────────────────────
LAST_IMAGE_FILE="$RELEASES_DIR/last_image.txt"
if [ ! -f "$LAST_IMAGE_FILE" ]; then
  log_error "Không có thông tin phiên bản trước để rollback!"
fi

PREV_IMAGE=$(cat "$LAST_IMAGE_FILE")
if [ "$PREV_IMAGE" = "none" ] || [ -z "$PREV_IMAGE" ]; then
  log_error "Không có phiên bản trước để rollback. Đây có phải là lần deploy đầu tiên?"
fi

log_info "Phiên bản hiện tại: $(docker inspect --format='{{.Config.Image}}' mattermost-app 2>/dev/null || echo 'không xác định')"
log_info "Rollback về: $PREV_IMAGE"

# ── Pull image cũ nếu chưa có local ─────────────────────────
log_info "Kiểm tra image $PREV_IMAGE..."
if ! docker image inspect "$PREV_IMAGE" &>/dev/null; then
  log_info "Pull image cũ từ registry..."
  docker pull "$PREV_IMAGE" || log_error "Không thể pull image cũ: $PREV_IMAGE"
fi

# ── Cập nhật .env để dùng image cũ ──────────────────────────
# Trích xuất tag từ image name (vd: mattermost-team-edition:9.11.0 → 9.11.0)
OLD_VERSION=$(echo "$PREV_IMAGE" | grep -oP ':[^:]+$' | tr -d ':' || echo "latest")
log_info "Chuyển MM_VERSION sang: $OLD_VERSION"

# Cập nhật biến tạm trong env file
sed -i "s/^MM_VERSION=.*/MM_VERSION=${OLD_VERSION}/" "$ENV_FILE"

# ── Restart với image cũ ─────────────────────────────────────
log_info "Restart containers với phiên bản cũ..."
cd "$DEPLOY_PATH"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

sleep 10
docker compose -f "$COMPOSE_FILE" ps

# ── Ghi log rollback ─────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cat >> "$RELEASES_DIR/deploy_history.log" << EOF
[$TIMESTAMP] ROLLBACK thực hiện | Về: $PREV_IMAGE | Steps: $STEPS
EOF

log_success "====== ROLLBACK HOÀN TẤT ======"
log_info "Hệ thống đang chạy với: $PREV_IMAGE"
