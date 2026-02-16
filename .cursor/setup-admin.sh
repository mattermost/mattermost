#!/usr/bin/env bash
set -euo pipefail

# PATH setup — Docker ENV may not carry through
export GOPATH="${GOPATH:-/home/ubuntu/go}"
export PATH="/usr/local/go/bin:${GOPATH}/bin:/usr/local/bin:${PATH}"

# Creates the initial admin user and default team for the
# Cursor Cloud Agent dev environment.
#
# Prerequisites:
#   - Mattermost server must be running
#   - Local mode must be enabled (ServiceSettings.EnableLocalMode = true)
#   - mmctl must be built (server/bin/mmctl)
#
# Usage: bash .cursor/setup-admin.sh

WORKSPACE_ROOT="$(pwd)"
MMCTL="${WORKSPACE_ROOT}/server/bin/mmctl"
SOCKET="/var/tmp/mattermost_cursor_cloud.sock"

ADMIN_EMAIL="admin@localhost"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="Passw0rd!"
TEAM_NAME="default"
TEAM_DISPLAY="Default"

echo ">>> Mattermost Admin Setup"

# Wait for the server to be ready (local socket must exist)
echo ">>> Waiting for Mattermost server to be ready..."
for i in $(seq 1 60); do
    if [ -S "${SOCKET}" ]; then
        echo ">>> Server socket found."
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo ">>> ERROR: Server did not start within 60 seconds."
        echo ">>> Socket not found at: ${SOCKET}"
        exit 1
    fi
    sleep 1
done

# Additional wait for the server to fully initialize
sleep 3

# Create admin user (idempotent -- will fail if user already exists)
echo ">>> Creating admin user..."
"${MMCTL}" --local user create \
    --email "${ADMIN_EMAIL}" \
    --username "${ADMIN_USERNAME}" \
    --password "${ADMIN_PASSWORD}" \
    --system-admin \
    --email-verified 2>/dev/null \
    && echo ">>> Admin user created." \
    || echo ">>> Admin user already exists (or creation failed)."

# Create default team (idempotent)
echo ">>> Creating default team..."
"${MMCTL}" --local team create \
    --name "${TEAM_NAME}" \
    --display-name "${TEAM_DISPLAY}" 2>/dev/null \
    && echo ">>> Default team created." \
    || echo ">>> Default team already exists (or creation failed)."

# Add admin to the team
echo ">>> Adding admin to default team..."
"${MMCTL}" --local team users add "${TEAM_NAME}" "${ADMIN_USERNAME}" 2>/dev/null \
    && echo ">>> Admin added to team." \
    || echo ">>> Admin already in team (or add failed)."

echo ""
echo ">>> Admin setup complete!"
echo ">>> Login at http://localhost:8065"
echo ">>>   Username: ${ADMIN_USERNAME}"
echo ">>>   Password: ${ADMIN_PASSWORD}"
