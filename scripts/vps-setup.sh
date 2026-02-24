#!/bin/bash
# =============================================================
# VPS Setup Script - Chạy 1 lần trên VPS mới
# OS yêu cầu: Ubuntu 20.04 / 22.04
#
# Cách dùng:
#   sudo bash vps-setup.sh
# =============================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]  ${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERR] ${NC} $1"; exit 1; }

DEPLOY_USER="${DEPLOY_USER:-techzen}"
DEPLOY_PATH="/opt/mattermost"

# ── 1. Cập nhật OS ───────────────────────────────────────────
log_info "Cập nhật hệ thống..."
apt-get update -qq && apt-get upgrade -y -qq
log_success "Hệ thống đã cập nhật"

# ── 2. Cài Docker (chỉ khi chưa có) ──────────────────────────
if ! command -v docker &>/dev/null; then
  log_info "Cài Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  log_success "Docker đã cài xong"
else
  log_success "Docker đã có: $(docker --version)"
fi

# ── 3. Thêm user vào docker group ─────────────────────────────
if id "$DEPLOY_USER" &>/dev/null; then
  usermod -aG docker "$DEPLOY_USER"
  log_success "User $DEPLOY_USER thêm vào nhóm docker"
else
  log_warn "User $DEPLOY_USER không tồn tại, bỏ qua"
fi

# ── 4. Cài công cụ cần thiết ─────────────────────────────────
log_info "Cài thêm công cụ: curl, jq..."
apt-get install -y -qq curl jq
log_success "Đã cài đặt xong"

# ── 5. Cài Nginx (chỉ khi chưa có) ───────────────────────────
if command -v nginx &>/dev/null; then
  log_success "Nginx đã có: $(nginx -v 2>&1 | head -1) — bỏ qua cài đặt"
else
  log_info "Cài Nginx..."
  apt-get install -y -qq nginx
  log_success "Nginx đã cài xong"
fi

# ── 6. Tạo thư mục deploy ─────────────────────────────────────
log_info "Tạo cấu trúc thư mục $DEPLOY_PATH..."
mkdir -p "$DEPLOY_PATH"/{releases,scripts,nginx}
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
chmod 750 "$DEPLOY_PATH"
log_success "Thư mục đã tạo"

# ── 7. Cấu hình Nginx ─────────────────────────────────────────
log_info "Cấu hình Nginx reverse proxy..."
cat > /etc/nginx/sites-available/mattermost << 'NGINX_CONF'
upstream mattermost {
    server 127.0.0.1:8065;
    keepalive 32;
}

server {
    listen 80;
    server_name _;   # Chấp nhận mọi IP/domain

    client_max_body_size 50M;

    access_log /var/log/nginx/mattermost.access.log;
    error_log  /var/log/nginx/mattermost.error.log;

    # WebSocket support
    location ~ /api/v[0-9]+/(users/)?websocket$ {
        proxy_pass http://mattermost;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 86400;
    }

    location / {
        proxy_pass http://mattermost;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/mattermost /etc/nginx/sites-enabled/mattermost
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl restart nginx
log_success "Nginx đã cấu hình và khởi động"

# ── 8. Cấu hình UFW firewall ───────────────────────────────────
log_info "Cấu hình UFW firewall..."
if command -v ufw &>/dev/null; then
  ufw allow OpenSSH
  ufw allow 'Nginx Full'
  ufw --force enable
  log_success "UFW đã bật: chỉ cho phép SSH và HTTP/HTTPS"
else
  log_warn "ufw không có sẵn, bỏ qua cấu hình firewall"
fi

# ── 9. Kiểm tra .env ─────────────────────────────────────────
if [ ! -f "$DEPLOY_PATH/.env" ]; then
  log_warn "Chưa có file .env! Hãy tạo: $DEPLOY_PATH/.env (tham khảo .env.prod.example)"
fi

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ✅ VPS Setup Hoàn Tất!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Bước tiếp theo:"
echo "  1. Tạo file: $DEPLOY_PATH/.env  (copy từ .env.prod.example)"
echo "  2. Thêm SSH public key của GitHub Actions vào ~/.ssh/authorized_keys"
echo "  3. Cấu hình GitHub Repository Secrets (xem README.cicd.md)"
echo ""
