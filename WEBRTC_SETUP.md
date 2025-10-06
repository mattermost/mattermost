# WebRTC Setup for ProChat (ProgressNet Mattermost)

## Overview

This guide explains how to set up WebRTC calling capabilities in your ProChat application using the Mattermost Calls plugin with a dedicated RTC server.

## Architecture

```
┌─────────────────────────┐
│   ProChat Clients       │
│   (Web/Mobile/Desktop)  │
└──────────┬──────────────┘
           │ HTTPS/WSS
           │ (Signaling)
┌──────────▼──────────────────────────────┐
│  Mattermost Server                      │
│  Ubuntu ARM64 (8 cores, 16GB RAM)       │
│  - Port 8065: HTTP/WebSocket            │
│  - Calls Plugin v1.10.0                 │
│  - Call signaling & control             │
└──────────┬──────────────────────────────┘
           │ HTTP API
           │
┌──────────▼──────────────────────────────┐
│  RTC Server (rtcd)                      │
│  - Port 8443: HTTPS API                 │
│  - Port 8045: WebRTC UDP/TCP            │
│  - SFU (Selective Forwarding Unit)      │
│  - Media routing & mixing               │
└─────────────────────────────────────────┘
```

## Deployment Options

### Option 1: Integrated Mode (Good for <10 users)
**Plugin handles everything** - Simple setup, limited scalability

**Pros:**
- Single service to manage
- Minimal configuration
- Good for testing/small teams

**Cons:**
- Limited to ~10 concurrent users
- Server CPU can spike during calls
- No advanced features (recording, transcription)

### Option 2: Standalone RTC Server (Recommended for Production)
**Dedicated WebRTC SFU** - Better performance and scalability

**Pros:**
- Scales to 100+ concurrent users per server
- Better resource isolation
- Advanced features possible
- Can run on separate hardware

**Cons:**
- Requires additional server/container
- More configuration needed

## Installation Steps

### Step 1: Enable Calls Plugin

1. **Upload plugin** (already downloaded to `prepackaged_plugins/`):
   ```bash
   # Plugin file: mattermost-plugin-calls-v1.10.0.tar.gz
   ```

2. **Enable via System Console**:
   - Go to: http://localhost:8065
   - System Console → Plugins → Plugin Management
   - Upload: `prepackaged_plugins/mattermost-plugin-calls-v1.10.0.tar.gz`
   - Click "Enable Plugin"

3. **Configure basic settings**:
   - System Console → Plugins → Calls
   - Enable: ✓
   - Mode: Choose based on your needs (see below)

### Step 2: Choose Deployment Mode

#### Mode A: Integrated (Simple Setup)

**Configuration:**
```yaml
# In Calls plugin settings:
RTC Server Enable: false
Max Call Participants: 10
Enable Transcriptions: false
Enable Recordings: false
```

**That's it!** Calls will work immediately using the Mattermost server.

#### Mode B: Standalone RTC Server (Recommended)

### Step 3: Deploy RTC Server (rtcd)

#### Option 1: Docker Compose (Easiest)

Create `docker-compose.rtc.yml`:

```yaml
version: '3.8'

services:
  rtcd:
    image: mattermost/rtcd:v0.18.0
    container_name: prochat-rtcd
    restart: unless-stopped
    ports:
      - "8443:8443"  # HTTPS API
      - "8045:8045/udp"  # WebRTC UDP
      - "8045:8045/tcp"  # WebRTC TCP fallback
    environment:
      - RTCD_LOGGER_ENABLECONSOLE=true
      - RTCD_LOGGER_CONSOLELEVEL=INFO
      - RTCD_HTTP_SERVERADDRESS=0.0.0.0
      - RTCD_HTTP_SERVERPORT=8443
      - RTCD_RTC_ICEPORTUDP=8045
      - RTCD_RTC_ICEPORTTCP=8045
      # ICE servers for NAT traversal
      - RTCD_RTC_ICESERVERS='[{"urls":["stun:stun.l.google.com:19302"]}]'
    volumes:
      - ./rtcd_data:/data
    networks:
      - prochat_network

networks:
  prochat_network:
    driver: bridge
```

**Start RTC server:**
```bash
docker compose -f docker-compose.rtc.yml up -d
```

#### Option 2: Binary Installation (ARM64)

```bash
# Download rtcd for ARM64
cd /opt
sudo wget https://github.com/mattermost/rtcd/releases/download/v0.18.0/rtcd-linux-arm64.tar.gz
sudo tar -xzf rtcd-linux-arm64.tar.gz
sudo mv rtcd /usr/local/bin/

# Create config
sudo mkdir -p /etc/rtcd
sudo cat > /etc/rtcd/config.toml <<EOF
[HTTP]
ServerAddress = "0.0.0.0"
ServerPort = 8443

[RTC]
ICEPortUDP = 8045
ICEPortTCP = 8045

[[RTC.ICEServers]]
URLs = ["stun:stun.l.google.com:19302"]

[Logger]
EnableConsole = true
ConsoleLevel = "INFO"
EOF

# Create systemd service
sudo cat > /etc/systemd/system/rtcd.service <<EOF
[Unit]
Description=Mattermost RTC Server
After=network.target

[Service]
Type=simple
User=mattermost
ExecStart=/usr/local/bin/rtcd --config /etc/rtcd/config.toml
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable rtcd
sudo systemctl start rtcd
```

### Step 4: Configure Calls Plugin for RTC Server

**In System Console → Plugins → Calls:**

```yaml
RTC Server Enable: true
RTC Server Address: http://localhost:8443
RTC Server Port: 8443
Max Call Participants: 100
Enable Screen Sharing: true
Enable Recordings: true  # Requires additional config
Enable Transcriptions: false  # Requires AI service
```

### Step 5: Network Configuration

#### For Local Development:
- Mattermost: http://localhost:8065
- RTC Server: http://localhost:8443
- WebRTC Port: 8045 (UDP/TCP)

#### For Production (progressnet.gr):

**Required Ports:**
```
443/tcp  → Nginx → Mattermost (8065)
8443/tcp → Nginx → RTC API (8443)
8045/udp → Direct → RTC Media
8045/tcp → Direct → RTC Media (fallback)
```

**Nginx Configuration:**

```nginx
# Mattermost
upstream mattermost_backend {
    server 127.0.0.1:8065;
}

# RTC Server
upstream rtc_backend {
    server 127.0.0.1:8443;
}

# Mattermost HTTPS
server {
    listen 443 ssl http2;
    server_name prochat.progressnet.gr;

    ssl_certificate /etc/letsencrypt/live/prochat.progressnet.gr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prochat.progressnet.gr/privkey.pem;

    location / {
        proxy_pass http://mattermost_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# RTC API HTTPS
server {
    listen 8443 ssl http2;
    server_name prochat.progressnet.gr;

    ssl_certificate /etc/letsencrypt/live/prochat.progressnet.gr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prochat.progressnet.gr/privkey.pem;

    location / {
        proxy_pass http://rtc_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Firewall Rules (Ubuntu):**
```bash
# Allow WebRTC ports
sudo ufw allow 8045/udp comment 'RTC Media UDP'
sudo ufw allow 8045/tcp comment 'RTC Media TCP'
sudo ufw allow 8443/tcp comment 'RTC API'
sudo ufw allow 443/tcp comment 'HTTPS'
```

## TURN/STUN Configuration

For clients behind restrictive NATs (corporate firewalls), configure TURN servers:

### Option 1: Use Public STUN (Free, Limited)
```toml
[[RTC.ICEServers]]
URLs = ["stun:stun.l.google.com:19302"]
```

### Option 2: Self-Hosted TURN (Recommended for Production)

**Install coturn:**
```bash
sudo apt install coturn

# Configure /etc/turnserver.conf
sudo cat > /etc/turnserver.conf <<EOF
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=YOUR_SECRET_KEY_HERE
realm=prochat.progressnet.gr
total-quota=100
bps-capacity=0
stale-nonce=600
no-multicast-peers
no-stdout-log
EOF

# Start coturn
sudo systemctl enable coturn
sudo systemctl start coturn

# Open port
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
```

**Update rtcd config:**
```toml
[[RTC.ICEServers]]
URLs = ["turn:prochat.progressnet.gr:3478"]
Username = "your_username"
Credential = "YOUR_SECRET_KEY_HERE"
```

## Testing

### 1. Test RTC Server
```bash
curl http://localhost:8443/version
# Should return: {"BuildDate":"...","BuildHash":"...","Version":"..."}
```

### 2. Start a Call
1. Go to any channel
2. Click the phone icon (top right)
3. Select "Start call"
4. Invite participants

### 3. Verify WebRTC Connection
- Open browser DevTools → Network → WS
- Should see WebSocket connection to Mattermost
- Open chrome://webrtc-internals/ to see ICE candidates

## Performance Tuning

### For 8 core ARM64 Server (Your Setup):

**RTC Server Resources:**
- 10 users: ~0.5-1 core, 1GB RAM
- 50 users: ~2-3 cores, 4GB RAM
- 100 users: ~4-6 cores, 8GB RAM

**Recommended limits:**
```toml
[RTC]
MaxConcurrentSessions = 50  # Adjust based on usage
MaxCallParticipants = 20    # Per call limit
```

## Monitoring

### Check RTC Server Status:
```bash
# Docker
docker logs prochat-rtcd -f

# Systemd
sudo journalctl -u rtcd -f
```

### Check Active Calls:
```bash
curl http://localhost:8443/stats
```

## Troubleshooting

### Issue: Calls connect but no audio/video

**Cause:** Firewall blocking WebRTC ports

**Solution:**
```bash
# Check if ports are open
sudo netstat -tulpn | grep 8045
sudo ufw status
```

### Issue: Calls fail in restrictive networks

**Cause:** NAT/Firewall blocking UDP

**Solution:** Configure TURN server (see above)

### Issue: High CPU usage

**Cause:** Too many concurrent calls

**Solution:**
- Reduce `MaxCallParticipants`
- Deploy additional RTC servers
- Use hardware video encoding (if available)

## Alternative: Jitsi Integration

If you need more advanced features (e.g., recording, streaming, dial-in):

### Jitsi Plugin Setup:

1. **Install Jitsi Meet** (separate guide needed)
2. **Install Jitsi plugin:**
   ```bash
   # Download from marketplace or build from source
   ```
3. **Configure in System Console:**
   - Jitsi URL: https://meet.progressnet.gr
   - JWT authentication (optional)

**Pros:**
- More mature
- Better recording/streaming
- Phone dial-in support

**Cons:**
- More complex setup
- Separate infrastructure
- Less integrated UX

## Summary

For your **ProgressNet ProChat** deployment:

1. ✅ **Immediate Start**: Enable Calls plugin in integrated mode
2. ✅ **Production Ready**: Deploy standalone rtcd server
3. ✅ **Scale**: Add TURN server for NAT traversal
4. ✅ **Monitor**: Check logs and stats regularly

The Calls plugin is already downloaded and ready to be installed via the System Console!
