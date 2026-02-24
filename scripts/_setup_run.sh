#!/bin/bash
set -euo pipefail

echo "====== VPS SETUP & INFO ======"

# --- Thông tin nginx container ---
echo ""
echo "[1] Kiểm tra common-nginx volumes:"
docker inspect common-nginx 2>/dev/null | grep -A3 '"Mounts"' | head -20 || echo "Không lấy được volumes"

echo ""
echo "[2] Networks của common-nginx:"
docker inspect common-nginx 2>/dev/null | grep -A5 '"Networks"' | head -20 || echo "Không lấy được networks"

echo ""
echo "[3] Kiểm tra /etc/nginx/conf.d/ trong container:"
docker exec common-nginx ls /etc/nginx/conf.d/ 2>/dev/null || echo "Không exec được"

echo ""
echo "[4] Tạo thư mục /opt/mattermost..."
mkdir -p /opt/mattermost/{releases,scripts,nginx}
chmod 750 /opt/mattermost
echo "OK: /opt/mattermost đã tạo"

echo ""
echo "[5] Copy scripts vào /opt/mattermost/scripts/..."
cp /tmp/deploy.sh /tmp/rollback.sh /opt/mattermost/scripts/
cp /tmp/docker-compose.prod.yml /opt/mattermost/
chmod +x /opt/mattermost/scripts/*.sh
echo "OK: Scripts đã copy"

echo ""
echo "[6] Kiểm tra .env hiện tại:"
if [ -f /opt/mattermost/.env ]; then
    echo ".env đã tồn tại:"
    cat /opt/mattermost/.env
else
    echo ".env chưa có - sẽ tạo từ template"
    cp /tmp/.env.prod.example /opt/mattermost/.env
    sed -i 's/MM_DB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD/MM_DB_PASSWORD=TechZEN@MM2026/' /opt/mattermost/.env
    sed -i 's|MM_SITE_URL=.*|MM_SITE_URL=http://103.146.23.11:8065|' /opt/mattermost/.env
    echo "OK: .env đã tạo"
    cat /opt/mattermost/.env
fi

echo ""
echo "====== SETUP HOÀN TẤT ======"
