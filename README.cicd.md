# CI/CD Pipeline — Hướng dẫn cấu hình

Tài liệu này hướng dẫn cách thiết lập CI/CD pipeline để deploy Mattermost lên VPS tự động khi push lên nhánh `main`.

---

## Kiến trúc tổng quan

```
push → main
    └─→ GitHub Actions: deploy-vps.yml
            ├─ validate  (kiểm tra cú pháp)
            ├─ deploy    (SSH → VPS → docker compose up)
            ├─ health-check (ping /api/v4/system/ping)
            └─ notify    (Mattermost webhook)
```

---

## Bước 1: Chuẩn bị VPS

### 1.1 Chạy setup script (1 lần duy nhất)

```bash
# SSH vào VPS
ssh -p 1401 techzen@103.146.23.11

# Tải và chạy setup script
curl -O https://raw.githubusercontent.com/YOUR_ORG/YOUR_REPO/main/scripts/vps-setup.sh
sudo bash vps-setup.sh
```

### 1.2 Tạo file .env trên VPS

```bash
# Trên VPS
nano /opt/mattermost/.env
```

Nội dung (copy từ `.env.prod.example` và điền giá trị thật):

```env
MM_VERSION=latest
MM_DB_USER=mmuser
MM_DB_PASSWORD=YOUR_STRONG_PASSWORD
MM_DB_NAME=mattermost
MM_SITE_URL=http://103.146.23.11
```

### 1.3 Tạo SSH key cho GitHub Actions

```bash
# Chạy trên máy LOCAL (không phải VPS)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""

# Copy public key lên VPS
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub -p 1401 techzen@103.146.23.11

# In ra private key để copy vào GitHub Secrets
cat ~/.ssh/github_actions_deploy
```

---

## Bước 2: Cấu hình GitHub Repository Secrets

Vào **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**

| Tên Secret | Giá trị |
|---|---|
| `VPS_HOST` | `103.146.23.11` |
| `VPS_USER` | `techzen` |
| `VPS_SSH_PORT` | `1401` |
| `VPS_SSH_KEY` | Nội dung file `~/.ssh/github_actions_deploy` (private key) |
| `MM_WEBHOOK_URL` | `https://techchat.techzen.vn/hooks/if8cyu8qjf8pzb17pyhta39ymh` |

> **Lưu ý:** Không thêm `MM_DB_PASSWORD` vào GitHub Secrets vì nó đã nằm trong file `.env` trên VPS.

---

## Bước 3: Kiểm tra pipeline

### 3.1 Trigger deploy

```bash
# Trên máy local
git add .
git commit -m "feat: add CI/CD pipeline"
git push origin main
```

### 3.2 Xem logs pipeline

Vào **GitHub Repo → Actions → Deploy to VPS**

### 3.3 Kiểm tra thủ công trên VPS

```bash
ssh -p 1401 techzen@103.146.23.11

# Xem trạng thái containers
cd /opt/mattermost
docker compose -f docker-compose.prod.yml ps

# Xem logs Mattermost
docker compose -f docker-compose.prod.yml logs -f mattermost

# Health check
curl -s http://localhost:8065/api/v4/system/ping
```

---

## Rollback thủ công

Khi cần rollback khẩn cấp:

1. Vào **GitHub Repo → Actions → Rollback VPS**
2. Click **Run workflow**
3. Chọn số bước rollback và nhập lý do
4. Click **Run workflow**

Hoặc rollback trực tiếp trên VPS:

```bash
ssh -p 1401 techzen@103.146.23.11
bash /opt/mattermost/scripts/rollback.sh
```

---

## Cấu trúc files CI/CD

```
mattermost/
├── .github/
│   └── workflows/
│       ├── deploy-vps.yml       # Pipeline deploy chính (auto khi push main)
│       └── rollback-vps.yml     # Rollback thủ công
├── scripts/
│   ├── vps-setup.sh             # Setup VPS lần đầu
│   ├── deploy.sh                # Script deploy chạy trên VPS
│   └── rollback.sh              # Script rollback chạy trên VPS
├── docker-compose.prod.yml      # Docker Compose production
└── .env.prod.example            # Template biến môi trường
```

---

## Troubleshooting

### Deploy fail do SSH timeout

```bash
# Kiểm tra SSH key đã thêm vào VPS chưa
ssh -p 1401 -i ~/.ssh/github_actions_deploy techzen@103.146.23.11 echo "OK"
```

### Mattermost không khởi động

```bash
# Xem logs
docker logs mattermost-app --tail 100

# Kiểm tra .env
cat /opt/mattermost/.env
```

### Nginx 502 Bad Gateway

```bash
# Kiểm tra Mattermost có đang chạy
curl -s http://localhost:8065/api/v4/system/ping

# Reload Nginx
sudo nginx -t && sudo systemctl reload nginx
```
