# Deploy rtcd on Jitsi Server - Step by Step Guide

**Option A: Hybrid Setup** - rtcd + Jitsi Meet on same server
**Nginx Config Location**: `/etc/nginx/conf.d/`
**Estimated Time**: 45 minutes

---

## Prerequisites Checklist

- [ ] SSH access to Jitsi server
- [ ] Sudo privileges
- [ ] Jitsi Meet already installed and working
- [ ] Domain name configured (e.g., jitsi.progressnet.gr)
- [ ] SSL certificates present (Let's Encrypt)

---

## Part 1: Pre-Deployment Checks (5 minutes)

### Step 1.1: SSH into Jitsi Server

```bash
ssh user@jitsi.progressnet.gr
# Or use your actual server address
```

### Step 1.2: Check Port Availability

```bash
# Check if port 8443 is available
sudo netstat -tulpn | grep :8443

# Expected: No output = port is FREE ✅
# If you see output = port is IN USE ⚠️ (use 8444 instead)
```

**Decision Point:**
- ✅ If **NO OUTPUT**: Use port **8443** (continue with Option A)
- ⚠️ If **OUTPUT SHOWS**: Use port **8444** (use Option B configs)

```bash
# Also check 8045
sudo netstat -tulpn | grep :8045
# Should be free (no output)
```

### Step 1.3: Verify Jitsi is Running

```bash
# Check Jitsi services
sudo systemctl status jitsi-videobridge2
sudo systemctl status jicofo
sudo systemctl status prosody

# All should show "active (running)"
```

### Step 1.4: Check Current Nginx Config Location

```bash
# Verify nginx config directory
ls -la /etc/nginx/conf.d/

# Check if there's existing Jitsi config
ls -la /etc/nginx/sites-enabled/
```

### Step 1.5: Note Your SSL Certificate Path

```bash
# Find your SSL certificates
sudo ls -la /etc/letsencrypt/live/

# Note the domain folder, e.g., /etc/letsencrypt/live/jitsi.progressnet.gr/
```

**Write down your domain:** ___________________________

---

## Part 2: Install rtcd (15 minutes)

### Step 2.1: Download rtcd Binary

```bash
# Change to /opt directory
cd /opt

# Download rtcd (use amd64 or arm64 based on your server)
# For x86_64/AMD64:
sudo wget https://github.com/mattermost/rtcd/releases/download/v0.18.0/rtcd-linux-amd64.tar.gz

# For ARM64 (if your Jitsi is on ARM):
# sudo wget https://github.com/mattermost/rtcd/releases/download/v0.18.0/rtcd-linux-arm64.tar.gz

# Extract
sudo tar -xzf rtcd-linux-amd64.tar.gz

# Move to system binary location
sudo mv rtcd /usr/local/bin/
sudo chmod +x /usr/local/bin/rtcd

# Verify installation
/usr/local/bin/rtcd version
# Should show version info
```

### Step 2.2: Create rtcd System User

```bash
# Create dedicated user for rtcd
sudo useradd -r -s /bin/false -d /var/lib/rtcd rtcd

# Create directories
sudo mkdir -p /etc/rtcd
sudo mkdir -p /var/lib/rtcd

# Set ownership
sudo chown -R rtcd:rtcd /etc/rtcd
sudo chown -R rtcd:rtcd /var/lib/rtcd
```

### Step 2.3: Create rtcd Configuration

**IMPORTANT:** Choose config based on port availability from Step 1.2

#### If port 8443 is FREE (Option A):

```bash
sudo tee /etc/rtcd/config.toml > /dev/null <<'EOF'
[HTTP]
ServerAddress = "0.0.0.0"
ServerPort = 8443
APISecurityAllowSelfRegistration = true

[RTC]
# Leave empty to auto-detect public IP
ICEHostOverride = ""
ICEPortUDP = 8045
ICEPortTCP = 8045

# STUN servers for NAT traversal
[[RTC.ICEServers]]
URLs = ["stun:stun.l.google.com:19302"]

[Logger]
EnableConsole = true
ConsoleLevel = "INFO"
EnableFile = true
FileLocation = "/var/lib/rtcd/rtcd.log"
FileLevel = "DEBUG"

[Store]
DataSource = "/var/lib/rtcd/rtcd.db"
EOF
```

#### If port 8443 is IN USE (Option B):

```bash
sudo tee /etc/rtcd/config.toml > /dev/null <<'EOF'
[HTTP]
ServerAddress = "0.0.0.0"
ServerPort = 8444
APISecurityAllowSelfRegistration = true

[RTC]
ICEHostOverride = ""
ICEPortUDP = 8046
ICEPortTCP = 8046

[[RTC.ICEServers]]
URLs = ["stun:stun.l.google.com:19302"]

[Logger]
EnableConsole = true
ConsoleLevel = "INFO"
EnableFile = true
FileLocation = "/var/lib/rtcd/rtcd.log"
FileLevel = "DEBUG"

[Store]
DataSource = "/var/lib/rtcd/rtcd.db"
EOF
```

```bash
# Set ownership
sudo chown rtcd:rtcd /etc/rtcd/config.toml
```

### Step 2.4: Create Systemd Service

```bash
sudo tee /etc/systemd/system/rtcd.service > /dev/null <<'EOF'
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

### Step 2.5: Start rtcd Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable rtcd to start on boot
sudo systemctl enable rtcd

# Start rtcd
sudo systemctl start rtcd

# Check status
sudo systemctl status rtcd

# Should show "active (running)" in green
```

### Step 2.6: Verify rtcd is Running

```bash
# Check if it's listening on the correct port
# For Option A (8443):
sudo netstat -tulpn | grep :8443 | grep rtcd

# For Option B (8444):
sudo netstat -tulpn | grep :8444 | grep rtcd

# Test the API
# For Option A:
curl http://localhost:8443/version

# For Option B:
curl http://localhost:8444/version

# Expected output:
# {"BuildDate":"2024-XX-XX","BuildHash":"...","Version":"0.18.0"}
```

### Step 2.7: Check rtcd Logs

```bash
# View real-time logs
sudo journalctl -u rtcd -f

# Press Ctrl+C to exit

# View last 50 lines
sudo journalctl -u rtcd -n 50
```

---

## Part 3: Configure Nginx (10 minutes)

### Step 3.1: Create rtcd Nginx Configuration

**Download the pre-made config file from your ProChat server:**

```bash
# On Jitsi server, download the config
cd /tmp
wget YOUR_PROCHAT_SERVER/rtcd-nginx.conf
# Or copy it manually
```

**OR create it directly:**

#### For Option A (port 8443):

```bash
sudo tee /etc/nginx/conf.d/rtcd.conf > /dev/null <<'EOF'
# Mattermost rtcd Configuration
server {
    listen 8443 ssl http2;
    server_name YOUR_DOMAIN_HERE;  # CHANGE THIS!

    # SSL certificates (same as Jitsi)
    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN_HERE/fullchain.pem;  # CHANGE THIS!
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN_HERE/privkey.pem;  # CHANGE THIS!

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5:!3DES;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;

    access_log /var/log/nginx/rtcd-access.log;
    error_log /var/log/nginx/rtcd-error.log;

    location / {
        proxy_pass http://127.0.0.1:8443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 60;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    location /version {
        proxy_pass http://127.0.0.1:8443/version;
        access_log off;
    }
}
EOF
```

**IMPORTANT:** Replace `YOUR_DOMAIN_HERE` with your actual domain:

```bash
# Replace domain in config (adjust your domain)
sudo sed -i 's/YOUR_DOMAIN_HERE/jitsi.progressnet.gr/g' /etc/nginx/conf.d/rtcd.conf

# Verify the changes
grep server_name /etc/nginx/conf.d/rtcd.conf
grep ssl_certificate /etc/nginx/conf.d/rtcd.conf
```

### Step 3.2: Test Nginx Configuration

```bash
# Test configuration syntax
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**If errors occur:**
- Check domain name is correct
- Check SSL certificate paths exist
- Check syntax (no missing semicolons)

### Step 3.3: Reload Nginx

```bash
# Reload nginx to apply changes
sudo systemctl reload nginx

# Check nginx status
sudo systemctl status nginx

# Should show "active (running)"
```

---

## Part 4: Configure Firewall (5 minutes)

### Step 4.1: Open Required Ports

#### For Option A (8443 + 8045):

```bash
# Open rtcd API port
sudo ufw allow 8443/tcp comment 'rtcd API'

# Open rtcd media ports
sudo ufw allow 8045/udp comment 'rtcd Media UDP'
sudo ufw allow 8045/tcp comment 'rtcd Media TCP'
```

#### For Option B (8444 + 8046):

```bash
sudo ufw allow 8444/tcp comment 'rtcd API'
sudo ufw allow 8046/udp comment 'rtcd Media UDP'
sudo ufw allow 8046/tcp comment 'rtcd Media TCP'
```

### Step 4.2: Verify Firewall Rules

```bash
# Check firewall status
sudo ufw status numbered

# Should show your new rules
```

---

## Part 5: Test rtcd Installation (5 minutes)

### Step 5.1: Local Test

```bash
# Test via localhost (should work)
curl http://localhost:8443/version

# Test via domain (should work with SSL)
curl https://jitsi.progressnet.gr:8443/version

# Both should return version info
```

### Step 5.2: External Test (from ProChat server)

```bash
# On your ProChat server, test connectivity
curl https://jitsi.progressnet.gr:8443/version

# Should return version info
```

### Step 5.3: Browser Test

Open in browser:
```
https://jitsi.progressnet.gr:8443/version
```

Should see JSON response with version info.

---

## Part 6: Configure Mattermost Calls Plugin (5 minutes)

### Step 6.1: Access ProChat System Console

1. Open browser: `http://your-prochat-server:8065`
2. Login as admin
3. Go to: **System Console** (top left menu)

### Step 6.2: Upload Calls Plugin

1. Navigate to: **Plugins** → **Plugin Management**
2. Click **"Choose File"**
3. Select: `prepackaged_plugins/mattermost-plugin-calls-v1.10.0.tar.gz`
4. Click **"Upload"**
5. Wait for upload to complete
6. Click **"Enable"** next to the Calls plugin

### Step 6.3: Configure Calls Plugin

1. Navigate to: **Plugins** → **Calls**

2. **Configure these settings:**

```yaml
Enable Plugin: Yes ✓

# RTC Server Configuration
RTC Server Enable: Yes ✓
RTC Server Address: https://jitsi.progressnet.gr:8443
# (Use your actual domain and port)

# Call Settings
Max Call Participants: 100
Default Enabled: Yes ✓
Enable Screen Sharing: Yes ✓
Enable Recordings: No (or configure later)

# Advanced
ICE Host Override: jitsi.progressnet.gr
# (Your Jitsi server domain or public IP)
```

3. Click **"Save"**

4. **Restart Mattermost** (or just reload the plugin):
   - Scroll to bottom
   - Click **"Reload Plugin"**

---

## Part 7: Test Calls in ProChat (5 minutes)

### Step 7.1: Enable Calls in a Channel

1. Go to any channel in ProChat
2. Look for the **phone icon** (📞) in the top right corner
3. Click it → **"Start call"**

### Step 7.2: Join the Call

1. Click **"Join call"**
2. Allow browser to access camera/microphone
3. You should see yourself in video

### Step 7.3: Invite Another User

1. Click **"Invite"** or share the call link
2. Have another user join
3. Test audio/video

### Step 7.4: Check WebRTC Connection

**In browser DevTools (F12):**

1. Open **Console** tab
2. Should see WebSocket connections to ProChat server
3. Open **chrome://webrtc-internals/** (Chrome) or **about:webrtc** (Firefox)
4. Should see ICE candidates connecting to `jitsi.progressnet.gr:8045`

---

## Monitoring & Troubleshooting

### Check rtcd Status

```bash
# On Jitsi server
sudo systemctl status rtcd

# View logs
sudo journalctl -u rtcd -f

# Check stats
curl http://localhost:8443/stats
```

### Check Active Calls

```bash
curl http://localhost:8443/stats | jq
```

### Common Issues

#### Issue 1: "Connection refused" when testing

**Solution:**
```bash
# Check if rtcd is running
sudo systemctl status rtcd

# Check if port is open
sudo netstat -tulpn | grep rtcd

# Check firewall
sudo ufw status | grep 8443
```

#### Issue 2: SSL certificate errors

**Solution:**
```bash
# Verify certificate paths
sudo ls -la /etc/letsencrypt/live/YOUR_DOMAIN/

# Test nginx config
sudo nginx -t

# Check nginx error log
sudo tail -f /var/log/nginx/error.log
```

#### Issue 3: Calls connect but no audio/video

**Solution:**
- Check UDP port 8045 is open
- Verify ICE Host Override in plugin settings
- Check browser console for WebRTC errors
- May need TURN server for strict NAT environments

---

## Success Checklist

- [ ] rtcd installed and running
- [ ] rtcd accessible via `https://jitsi.progressnet.gr:8443/version`
- [ ] Firewall ports open (8443 TCP, 8045 UDP/TCP)
- [ ] Nginx proxy configured and working
- [ ] Calls plugin installed in ProChat
- [ ] Calls plugin configured to use rtcd server
- [ ] Test call completed successfully
- [ ] Audio and video working

---

## Next Steps

### Optional Enhancements

1. **Configure TURN Server** (for restrictive NAT):
   - Install coturn
   - Update rtcd config with TURN credentials
   - See `WEBRTC_SETUP.md` for details

2. **Enable Call Recordings**:
   - Configure storage for recordings
   - Update Calls plugin settings

3. **Setup Monitoring**:
   - Add rtcd to your monitoring system
   - Set up alerts for service down

4. **Load Testing**:
   - Test with multiple concurrent calls
   - Monitor CPU/RAM usage
   - Adjust `MaxCallParticipants` as needed

---

## Configuration Files Summary

**On Jitsi Server:**
- `/etc/rtcd/config.toml` - rtcd configuration
- `/etc/systemd/system/rtcd.service` - systemd service
- `/etc/nginx/conf.d/rtcd.conf` - Nginx proxy config
- `/var/lib/rtcd/` - rtcd data directory
- `/var/log/nginx/rtcd-*.log` - Nginx logs

**On ProChat Server:**
- System Console → Plugins → Calls - Plugin configuration

---

## Support

If you encounter issues:

1. Check logs: `sudo journalctl -u rtcd -n 100`
2. Verify connectivity: `curl https://YOUR_DOMAIN:8443/version`
3. Check plugin settings in Mattermost System Console
4. Review browser console (F12) for WebRTC errors

---

**You're all set! Enjoy your ProChat calls powered by rtcd! 🎉📞**
