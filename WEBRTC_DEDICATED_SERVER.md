# ProChat WebRTC: Dedicated Server Deployment

## Your Architecture

```
┌─────────────────────────────────────────┐
│  ProChat Server (Ubuntu ARM64)          │
│  Location: Main Application Server      │
│  - Mattermost (8065)                    │
│  - PostgreSQL, Redis, MinIO             │
│  - Calls Plugin (signaling only)        │
└───────────────┬─────────────────────────┘
                │
                │ HTTPS API
                │ (signaling & control)
                │
┌───────────────▼─────────────────────────┐
│  Dedicated Jitsi/RTC Server             │
│  Location: Separate Server              │
│  - Jitsi Meet (existing, low load)      │
│  - rtcd (new, ProChat calls)            │
│  - Ports: 8443 (API), 8045 (media)      │
└─────────────────────────────────────────┘
```

## Why This Architecture is Optimal

✅ **Resource Isolation**

-   Chat/API server CPU stays free for database operations
-   WebRTC doesn't compete with PostgreSQL for resources
-   Better overall system stability

✅ **Scalability**

-   Can add more RTC servers without touching main server
-   Scale calls independently from chat

✅ **Performance**

-   No WebRTC CPU spikes on main server
-   Better chat responsiveness during heavy call periods
-   Dedicated bandwidth for media

✅ **Cost Effective**

-   Using existing infrastructure
-   No additional server costs

## Deployment Options

### Option A: Hybrid Setup (Recommended)

Run **both** Jitsi and rtcd on the same dedicated server.

**Use Cases:**

-   `rtcd` → Quick internal team calls in ProChat
-   `Jitsi Meet` → Important meetings with recording, external guests

**Why Both?**

-   rtcd: Lighter, faster for quick huddles
-   Jitsi: Full-featured for formal meetings
-   No conflicts (different ports)

### Option B: Jitsi-Only Setup

Use your existing Jitsi server directly with Mattermost Jitsi plugin.

**Simpler but less flexible.**

---

## Implementation: Option A (Hybrid)

### Step 1: Check for Port Conflicts

**IMPORTANT:** First verify which ports are available on your Jitsi server.

**Run the port check script:**

```bash
# SSH into your Jitsi server
ssh user@your-jitsi-server.com

# Download and run the check script
wget https://raw.githubusercontent.com/YOUR_REPO/CHECK_JITSI_PORTS.sh
bash CHECK_JITSI_PORTS.sh
```

**Or check manually:**

```bash
# Check if ports are in use
sudo netstat -tulpn | grep -E ':(8443|8045)'

# If port 8443 is in use, use 8444 or 7443 instead
# If port 8045 is in use, use 8046 instead
```

**Common Jitsi Ports (avoid these):**

-   443 - Nginx HTTPS
-   4443 - Jitsi Videobridge fallback
-   10000 - Jitsi Videobridge main RTP
-   8443 - **MAY conflict** (some Jitsi configs use this for OCTO)

**Recommended rtcd Ports:**

-   **Option A (if 8443 is free):** 8443 + 8045
-   **Option B (safest):** 8444 + 8046
-   **Option C (alternative):** 7443 + 8045

### Step 2: Install rtcd on Jitsi Server

**SSH into your Jitsi server:**

```bash
ssh user@your-jitsi-server.com
```

**Install rtcd:**

```bash
# Download rtcd (adjust architecture as needed)
cd /opt
sudo wget https://github.com/mattermost/rtcd/archive/refs/tags/v1.2.1.tar.gz
sudo tar -xzf rtcd-linux-amd64.tar.gz
sudo mv rtcd /usr/local/bin/
sudo chmod +x /usr/local/bin/rtcd

# Create rtcd user
sudo useradd -r -s /bin/false rtcd

# Create config directory
sudo mkdir -p /etc/rtcd
sudo chown rtcd:rtcd /etc/rtcd

# Create data directory
sudo mkdir -p /var/lib/rtcd
sudo chown rtcd:rtcd /var/lib/rtcd
```

**Create configuration:**

**CHOOSE YOUR PORTS BASED ON AVAILABILITY:**

```bash
# === OPTION A: Using 8443 + 8045 (if available) ===
sudo tee > /etc/rtcd/config.toml <<'EOF'
[HTTP]
ServerAddress = "0.0.0.0"
ServerPort = 8443
APISecurityAllowSelfRegistration = true

[RTC]
# Internal/private IP of this server
ICEHostOverride = ""  # Leave empty to auto-detect
ICEPortUDP = 8045
ICEPortTCP = 8045

# STUN servers for NAT traversal
[[RTC.ICEServers]]
URLs = ["stun:stun.l.google.com:19302"]

# TURN server (optional, recommended for restrictive networks)
# [[RTC.ICEServers]]
# URLs = ["turn:https://meet.promeet.gr:3478"]
# Username = "username"
# Credential = "password"

[Logger]
EnableConsole = true
ConsoleLevel = "INFO"
EnableFile = true
FileLocation = "/var/lib/rtcd/rtcd.log"
FileLevel = "DEBUG"

[Store]
DataSource = "/var/lib/rtcd/rtcd.db"
EOF

sudo chown rtcd:rtcd /etc/rtcd/config.toml

# === OPTION B: Using 8444 + 8046 (safest, no conflicts) ===
# If 8443 is in use, use this instead:
# sudo cat > /etc/rtcd/config.toml <<'EOF'
# [HTTP]
# ServerAddress = "0.0.0.0"
# ServerPort = 8444
# APISecurityAllowSelfRegistration = true
#
# [RTC]
# ICEHostOverride = ""
# ICEPortUDP = 8046
# ICEPortTCP = 8046
# ... (rest same as above)
# EOF
```

**IMPORTANT:** Remember which ports you chose! You'll need them for:

-   Firewall configuration
-   Nginx proxy configuration
-   Mattermost Calls plugin configuration

**Create systemd service:**

```bash
sudo cat > /etc/systemd/system/rtcd.service <<'EOF'
[Unit]
Description=Mattermost RTC Server (rtcd)
After=network.target
Documentation=https://github.com/mattermost/rtcd

[Service]
Type=simple
User=rtcd
Group=rtcd
ExecStart=/usr/local/bin/rtcd --config /etc/rtcd/config.toml
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/rtcd

[Install]
WantedBy=multi-user.target
EOF
```

**Start and enable rtcd:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable rtcd
sudo systemctl start rtcd

# Check status
sudo systemctl status rtcd

# View logs
sudo journalctl -u rtcd -f
```

### Step 2: Configure Firewall (Jitsi Server)

```bash
# Allow rtcd ports
sudo ufw allow 8443/tcp comment 'rtcd API'
sudo ufw allow 8045/udp comment 'rtcd WebRTC UDP'
sudo ufw allow 8045/tcp comment 'rtcd WebRTC TCP'

# Verify
sudo ufw status
```

### Step 3: Verify rtcd is Running

```bash
# Test API endpoint
curl http://localhost:8443/version

# Should return:
# {"BuildDate":"...","BuildHash":"...","Version":"0.18.0"}

# Check listening ports
sudo netstat -tulpn | grep rtcd
# Should show:
# tcp    0.0.0.0:8443    LISTEN    rtcd
# udp    0.0.0.0:8045    rtcd
```

### Step 4: Configure SSL/TLS (Nginx)

**On Jitsi server, add rtcd proxy:**

```bash
sudo cat > /etc/nginx/sites-available/rtcd <<'EOF'
# RTC Server API
server {
    listen 8443 ssl http2;
    server_name meet.promeet.gr;

    # Use Jitsi's existing SSL certificates
    ssl_certificate /etc/letsencrypt/live/meet.promeet.gr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/meet.promeet.gr/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_read_timeout 86400;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/rtcd /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: Configure Calls Plugin (ProChat Server)

**On your ProChat server, configure the Calls plugin:**

1. **Go to System Console** (http://your-prochat-server:8065)
2. **Navigate to:** Plugins → Calls
3. **Configure:**

```yaml
Enable Plugin: true
RTC Server Enable: true
RTC Server Address: https://meet.promeet.gr:8443
Max Call Participants: 100
Default Enabled: true
Enable Screen Sharing: true
Enable Recordings: false # Or configure later
ICE Host Override: meet.promeet.gr # Public IP/domain
```

4. **Save & Restart**

### Step 6: Test the Setup

**From ProChat:**

1. Open any channel
2. Click the phone icon (top right)
3. Start a call
4. Check browser DevTools → Network → WS for WebSocket connections
5. Open `chrome://webrtc-internals/` to verify ICE candidates

**Expected behavior:**

-   Signaling: ProChat server (your-prochat-server.com)
-   Media: Jitsi server (https://meet.promeet.gr:8045)

---

## Alternative: Option B (Jitsi Plugin Only)

If you prefer to use Jitsi directly:

### Install Jitsi Plugin

```bash
# Download Jitsi plugin
wget https://github.com/mattermost/mattermost-plugin-jitsi/releases/download/v2.0.3/jitsi-2.0.3.tar.gz

# Upload via System Console → Plugins
```

### Configure

```yaml
Jitsi URL: https://https://meet.promeet.gr
JWT Enabled: false # Or configure JWT for security
Naming Scheme: words
Embed Video: true
```

**Pros:**

-   No rtcd installation needed
-   Uses existing Jitsi infrastructure
-   Advanced features (recording, transcription)

**Cons:**

-   Less integrated UX (opens in modal/new window)
-   Slightly heavier than rtcd

---

## Network Configuration

### Ports Required

**Jitsi Server:**

-   `443/tcp` - Jitsi Meet HTTPS (existing)
-   `8443/tcp` - rtcd API (new)
-   `8045/udp` - rtcd WebRTC media (new)
-   `8045/tcp` - rtcd WebRTC TCP fallback (new)
-   `10000/udp` - Jitsi video bridge (existing)

**ProChat Server:**

-   `443/tcp` or `8065/tcp` - Mattermost HTTPS

### DNS Configuration

```
prochat.progressnet.gr  → ProChat Server IP
jitsi.progressnet.gr    → Jitsi Server IP
```

### Firewall Rules

**On Jitsi Server:**

```bash
sudo ufw allow 8443/tcp
sudo ufw allow 8045/udp
sudo ufw allow 8045/tcp
sudo ufw allow 10000/udp  # Jitsi existing
```

**On ProChat Server:**

```bash
# Only needs outbound HTTPS to Jitsi server (usually allowed by default)
```

---

## Performance Considerations

### Expected Resource Usage (Jitsi Server)

**Jitsi Meet (existing):**

-   Idle: ~200MB RAM, <5% CPU
-   Active meeting (10 users): ~1GB RAM, 30-40% CPU

**rtcd (new):**

-   Idle: ~50MB RAM, <1% CPU
-   10 users calling: ~500MB RAM, 10-15% CPU
-   50 users calling: ~2GB RAM, 40-50% CPU

**Combined:**

-   Your low-load Jitsi server can easily handle rtcd
-   Both services are compatible
-   Different ports = no conflicts

### Scaling Path

1. **Phase 1 (Now):** rtcd on Jitsi server
2. **Phase 2 (Growth):** Add second rtcd instance
3. **Phase 3 (Scale):** Load balance multiple rtcd servers

```
ProChat Server
    ↓
Load Balancer
    ├─→ rtcd-1 (Jitsi server)
    ├─→ rtcd-2 (new server)
    └─→ rtcd-3 (new server)
```

---

## Monitoring

### rtcd Health Check

```bash
# On Jitsi server
curl http://localhost:8443/version
curl http://localhost:8443/stats
```

### Logs

```bash
# rtcd logs
sudo journalctl -u rtcd -f --since "1 hour ago"

# Jitsi logs (for comparison)
sudo journalctl -u jitsi-videobridge2 -f
```

### Metrics

**Check active calls:**

```bash
curl http://localhost:8443/stats | jq
```

**Response example:**

```json
{
    "sessions": 5,
    "users": 12,
    "uptime": 3600
}
```

---

## Troubleshooting

### Issue: rtcd can't start

**Check:**

```bash
sudo journalctl -u rtcd -n 50
# Look for port conflicts or permission errors
```

**Solution:**

```bash
# Check if port 8443 is already in use
sudo netstat -tulpn | grep 8443

# If Jitsi is using 8443, change rtcd to 8444
sudo systemctl stop rtcd
sudo sed -i 's/ServerPort = 8443/ServerPort = 8444/' /etc/rtcd/config.toml
sudo systemctl start rtcd
```

### Issue: Calls connect but no media

**Cause:** Firewall blocking UDP 8045

**Solution:**

```bash
# Verify firewall
sudo ufw status | grep 8045

# Add rule if missing
sudo ufw allow 8045/udp
```

### Issue: One-way audio

**Cause:** NAT/firewall asymmetry

**Solution:** Configure TURN server (see TURN section below)

---

## Optional: TURN Server Setup

For clients behind strict NAT/firewalls, add TURN:

```bash
# On Jitsi server, install coturn
sudo apt install coturn

# Configure
sudo cat > /etc/turnserver.conf <<'EOF'
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=YOUR_RANDOM_SECRET_KEY
realm=jitsi.progressnet.gr
total-quota=100
bps-capacity=0
stale-nonce=600
no-multicast-peers
EOF

# Enable and start
sudo systemctl enable coturn
sudo systemctl start coturn

# Firewall
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
```

**Update rtcd config:**

```toml
[[RTC.ICEServers]]
URLs = ["turn:jitsi.progressnet.gr:3478"]
Username = "username"
Credential = "YOUR_RANDOM_SECRET_KEY"
```

---

## Summary: Your Deployment

### Architecture

-   ✅ **ProChat Server**: Mattermost + Calls Plugin (signaling)
-   ✅ **Jitsi Server**: rtcd + Jitsi Meet (media)
-   ✅ **Separation**: Chat and calls isolated for performance
-   ✅ **Cost**: $0 additional (using existing infrastructure)

### Benefits

1. **No resource contention** on ProChat server
2. **Better scalability** for future growth
3. **Leverage existing infrastructure** efficiently
4. **High availability** (chat works even if calls down)

### Next Steps

1. Install rtcd on Jitsi server (30 min)
2. Configure Calls plugin to point to it (5 min)
3. Test calls (5 min)
4. Monitor and optimize 🎯

This is the **optimal architecture** for your ProChat deployment!
