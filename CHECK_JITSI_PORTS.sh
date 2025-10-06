#!/bin/bash
# Script to check which ports Jitsi is using on your server
# Run this on your Jitsi server: bash CHECK_JITSI_PORTS.sh

echo "=== Checking Jitsi Port Usage ==="
echo ""

echo "1. All listening ports:"
sudo netstat -tulpn | grep -E "(LISTEN|udp)" | sort -t: -k2 -n
echo ""

echo "2. Jitsi-specific processes and ports:"
echo ""
echo "Jitsi Videobridge:"
sudo netstat -tulpn | grep -i jvb || echo "Not found"
echo ""
echo "Prosody (XMPP):"
sudo netstat -tulpn | grep prosody || echo "Not found"
echo ""
echo "Jicofo:"
sudo netstat -tulpn | grep jicofo || echo "Not found"
echo ""
echo "Nginx:"
sudo netstat -tulpn | grep nginx || echo "Not found"
echo ""

echo "3. Checking specific ports we need for rtcd:"
echo ""
echo "Port 8443:"
sudo netstat -tulpn | grep :8443 && echo "⚠️  CONFLICT - Port 8443 is IN USE" || echo "✅ Port 8443 is FREE"
echo ""
echo "Port 8045 (UDP):"
sudo netstat -tulpn | grep :8045.*udp && echo "⚠️  CONFLICT - Port 8045/UDP is IN USE" || echo "✅ Port 8045/UDP is FREE"
echo ""
echo "Port 8045 (TCP):"
sudo netstat -tulpn | grep :8045.*tcp && echo "⚠️  CONFLICT - Port 8045/TCP is IN USE" || echo "✅ Port 8045/TCP is FREE"
echo ""

echo "4. Alternative safe ports if conflicts found:"
echo "   - 8444 (instead of 8443)"
echo "   - 8046 (instead of 8045)"
echo "   - 7443 (instead of 8443)"
echo ""

echo "=== Port Check Complete ==="
