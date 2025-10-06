# Port Configuration Reference for ProChat + Jitsi

## Port Conflict Analysis

### Jitsi Meet Default Ports (DO NOT USE for rtcd)

| Port      | Protocol | Service                    | Conflicts with rtcd? |
|-----------|----------|----------------------------|----------------------|
| 80        | TCP      | Nginx HTTP                 | ❌ No                |
| 443       | TCP      | Nginx HTTPS                | ❌ No                |
| 4443      | TCP      | JVB Fallback               | ❌ No                |
| 5222      | TCP      | Prosody XMPP Client        | ❌ No                |
| 5280      | TCP      | Prosody HTTP               | ❌ No                |
| 5347      | TCP      | Prosody XMPP Component     | ❌ No                |
| **8443**  | TCP      | **Jetty/OCTO (optional)**  | ⚠️ **MAYBE**        |
| 10000     | UDP      | JVB Main RTP               | ❌ No                |

### rtcd Required Ports

| Port      | Protocol | Purpose            | Jitsi Conflict Check |
|-----------|----------|--------------------|----------------------|
| **8443**  | TCP      | rtcd HTTPS API     | ⚠️ Check first       |
| **8045**  | UDP      | WebRTC Media (UDP) | ✅ Safe              |
| **8045**  | TCP      | WebRTC Media (TCP) | ✅ Safe              |

## Port Configuration Options

### Option A: Standard Ports (Check First!)

```
rtcd API:      8443/tcp
rtcd Media:    8045/udp + 8045/tcp
```

**Use if:**
- ✅ Port 8443 is NOT in use by Jitsi
- ✅ Your Jitsi doesn't use OCTO relay

**Check command:**
```bash
sudo netstat -tulpn | grep :8443
```

### Option B: Safe Alternative (Recommended)

```
rtcd API:      8444/tcp  (or 7443/tcp)
rtcd Media:    8046/udp + 8046/tcp  (or 8045 if free)
```

**Use if:**
- ⚠️ Port 8443 is already in use
- ✅ Guaranteed no conflicts

**Advantages:**
- No possibility of conflict
- Clear separation from Jitsi
- Easy to identify in firewall rules

### Option C: High Port Alternative

```
rtcd API:      9443/tcp
rtcd Media:    9045/udp + 9045/tcp
```

**Use if:**
- You want complete separation
- Your firewall policies prefer high ports

## How to Check Current Port Usage

### Quick Check
```bash
# Check specific ports
sudo netstat -tulpn | grep -E ':(8443|8444|8045|8046)'

# List all listening ports
sudo netstat -tulpn | grep LISTEN | sort -t: -k2 -n
```

### Detailed Check
```bash
# Check what's using 8443
sudo lsof -i :8443

# Check what's using 8045
sudo lsof -i :8045
```

### Jitsi Process Check
```bash
# Check Jitsi processes and their ports
ps aux | grep -E "(jitsi|prosody|jicofo|jvb)" | grep -v grep
sudo netstat -tulpn | grep -E "(jitsi|prosody|jicofo|jvb)"
```

## Configuration Matrix

### Scenario 1: Port 8443 is FREE
```toml
# /etc/rtcd/config.toml
[HTTP]
ServerPort = 8443

[RTC]
ICEPortUDP = 8045
ICEPortTCP = 8045
```

```yaml
# Mattermost Calls Plugin
RTC Server Address: https://jitsi.yourserver.com:8443
```

```nginx
# Nginx
listen 8443 ssl http2;
proxy_pass http://127.0.0.1:8443;
```

```bash
# Firewall
sudo ufw allow 8443/tcp
sudo ufw allow 8045/udp
sudo ufw allow 8045/tcp
```

### Scenario 2: Port 8443 is IN USE
```toml
# /etc/rtcd/config.toml
[HTTP]
ServerPort = 8444

[RTC]
ICEPortUDP = 8046
ICEPortTCP = 8046
```

```yaml
# Mattermost Calls Plugin
RTC Server Address: https://jitsi.yourserver.com:8444
```

```nginx
# Nginx
listen 8444 ssl http2;
proxy_pass http://127.0.0.1:8444;
```

```bash
# Firewall
sudo ufw allow 8444/tcp
sudo ufw allow 8046/udp
sudo ufw allow 8046/tcp
```

## Complete Network Diagram

### Architecture with Safe Ports (8444 + 8046)

```
Internet
    │
    ├─────→ 443/tcp ────→ Nginx ────→ Jitsi Meet
    │                                  (existing)
    │
    ├─────→ 8444/tcp ───→ Nginx ────→ rtcd API
    │                                  (new)
    │
    └─────→ 8046/udp ───→ (direct) ──→ rtcd Media
            8046/tcp                   (new)


ProChat Server                    Jitsi Server
     │                                 │
     │ HTTPS API (signaling)           │
     └────────────────────────────────→│
              Port 8444                │
                                       │
     ←────────────────────────────────→│
       WebRTC Media (P2P or relayed)   │
              Port 8046                │
```

## Testing Port Configuration

### 1. Test rtcd API
```bash
# Replace PORT with your chosen API port (8443 or 8444)
curl http://localhost:PORT/version

# Should return:
# {"BuildDate":"...","BuildHash":"...","Version":"0.18.0"}
```

### 2. Test from ProChat Server
```bash
# From ProChat server, test connectivity
curl https://jitsi.yourserver.com:PORT/version

# Check if UDP port is reachable (install nmap)
sudo nmap -sU -p 8046 jitsi.yourserver.com
```

### 3. Verify in Browser
```
https://jitsi.yourserver.com:8444/version
```

## Firewall Configuration Summary

### On Jitsi Server

#### If using 8443 + 8045:
```bash
sudo ufw allow 8443/tcp comment 'rtcd API'
sudo ufw allow 8045/udp comment 'rtcd Media UDP'
sudo ufw allow 8045/tcp comment 'rtcd Media TCP'
sudo ufw status numbered
```

#### If using 8444 + 8046:
```bash
sudo ufw allow 8444/tcp comment 'rtcd API'
sudo ufw allow 8046/udp comment 'rtcd Media UDP'
sudo ufw allow 8046/tcp comment 'rtcd Media TCP'
sudo ufw status numbered
```

### On ProChat Server
```bash
# Usually no changes needed (outbound connections allowed by default)
# If you have strict egress rules:
sudo ufw allow out to any port 8444 proto tcp
sudo ufw allow out to any port 8046
```

## Troubleshooting Port Issues

### Issue: "Address already in use"

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :8443

# Kill the process (if safe) or change rtcd port
sudo systemctl stop rtcd
# Edit /etc/rtcd/config.toml with new port
sudo systemctl start rtcd
```

### Issue: "Connection refused"

**Checklist:**
1. ✅ Is rtcd running? `sudo systemctl status rtcd`
2. ✅ Is port open in firewall? `sudo ufw status`
3. ✅ Is Nginx configured correctly? `sudo nginx -t`
4. ✅ Is SSL certificate valid? `curl https://...`

### Issue: "No route to host"

**Solution:**
```bash
# Check if server is reachable
ping jitsi.yourserver.com

# Check if port is accessible from outside
# From ProChat server:
telnet jitsi.yourserver.com 8444
```

## Recommended Configuration

### For Most Users (Best Balance):

**Ports:**
- API: `8444/tcp` (safe, no conflicts)
- Media: `8046/udp + 8046/tcp` (safe, no conflicts)

**Why:**
- ✅ Zero chance of Jitsi conflict
- ✅ Easy to remember (just +1 from 8443/8045)
- ✅ Clean separation in firewall rules
- ✅ Future-proof if Jitsi updates

**Configuration snippet:**
```bash
# Quick setup for recommended ports
export RTCD_API_PORT=8444
export RTCD_MEDIA_PORT=8046

# Use in all configs
echo "API Port: $RTCD_API_PORT"
echo "Media Port: $RTCD_MEDIA_PORT"
```

## Quick Reference Card

```
═══════════════════════════════════════════════════════════
           ProChat + Jitsi Port Reference
═══════════════════════════════════════════════════════════

JITSI (Existing):
  443/tcp    - Jitsi Meet Web
  10000/udp  - Jitsi Media

RTCD (New) - OPTION A:
  8443/tcp   - API
  8045/udp   - Media

RTCD (New) - OPTION B (Recommended):
  8444/tcp   - API
  8046/udp   - Media

CHECK BEFORE DEPLOYING:
  sudo netstat -tulpn | grep -E ':(8443|8444|8045|8046)'

═══════════════════════════════════════════════════════════
```

## Next Steps

1. ✅ Run port check on Jitsi server
2. ✅ Choose port configuration (A or B)
3. ✅ Update all configs with chosen ports:
   - `/etc/rtcd/config.toml`
   - `/etc/nginx/sites-available/rtcd`
   - Mattermost Calls plugin settings
   - Firewall rules
4. ✅ Test connectivity
5. ✅ Make first call!
