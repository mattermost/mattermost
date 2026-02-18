#!/usr/bin/env bash
set -euo pipefail

# Creates the initial admin user and default team for the
# Cursor Cloud Agent dev environment using the REST API.
#
# This script uses the REST API instead of mmctl --local because
# the local mode socket may not be available in Team Edition builds.
#
# Prerequisites:
#   - Mattermost server must be running (or this script will wait)
#
# Usage: bash .cursor/setup-admin.sh

SERVER_URL="${MM_SERVER_URL:-http://localhost:8065}"
ADMIN_EMAIL="admin@localhost"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="Passw0rd!"
TEAM_NAME="dev"
TEAM_DISPLAY="Development"

echo ">>> Mattermost Admin Setup"
echo ">>> Server URL: ${SERVER_URL}"

# Wait for the server to be ready via HTTP health check
echo ">>> Waiting for Mattermost server to be ready..."
MAX_WAIT=180
for i in $(seq 1 ${MAX_WAIT}); do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "${SERVER_URL}/api/v4/system/ping" 2>/dev/null) || HTTP_STATUS="000"
    if [ "${HTTP_STATUS}" = "200" ]; then
        echo ">>> Server is ready (HTTP 200 on /api/v4/system/ping)."
        break
    fi
    if [ "$i" -eq ${MAX_WAIT} ]; then
        echo ">>> ERROR: Server did not become ready within ${MAX_WAIT} seconds."
        echo ">>> Last HTTP status: ${HTTP_STATUS}"
        exit 1
    fi
    if [ $((i % 10)) -eq 0 ]; then
        echo ">>>   Still waiting... (${i}s, last status: ${HTTP_STATUS})"
    fi
    sleep 1
done

# Additional wait for the server to fully initialize after health check passes
sleep 2

# Create admin user via REST API (open server mode allows self-registration)
echo ">>> Creating admin user..."
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SERVER_URL}/api/v4/users" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"${ADMIN_EMAIL}\",
        \"username\": \"${ADMIN_USERNAME}\",
        \"password\": \"${ADMIN_PASSWORD}\"
    }" 2>/dev/null)

CREATE_BODY=$(echo "${CREATE_RESPONSE}" | head -n -1)
CREATE_STATUS=$(echo "${CREATE_RESPONSE}" | tail -n 1)

if [ "${CREATE_STATUS}" = "201" ]; then
    USER_ID=$(echo "${CREATE_BODY}" | jq -r '.id')
    echo ">>> Admin user created (id: ${USER_ID})."
else
    echo ">>> Admin user already exists (or creation returned ${CREATE_STATUS}), continuing..."
    USER_ID=""
fi

# Promote user to system admin via direct database update
# This is more reliable than API-based promotion since we don't have an admin token yet
echo ">>> Promoting user to system admin via database..."
PGPASSWORD=mostest psql -h localhost -U mmuser -d mattermost_test -c \
    "UPDATE users SET roles = 'system_admin system_user' WHERE username = '${ADMIN_USERNAME}' AND roles NOT LIKE '%system_admin%';" \
    2>/dev/null && echo ">>> Admin role granted." || echo ">>> Role update skipped (may already be admin)."

# Log in as admin to get a token for subsequent API calls
echo ">>> Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -D - -X POST "${SERVER_URL}/api/v4/users/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"login_id\": \"${ADMIN_USERNAME}\",
        \"password\": \"${ADMIN_PASSWORD}\"
    }" 2>/dev/null)

TOKEN=$(echo "${LOGIN_RESPONSE}" | grep -i "^token:" | awk '{print $2}' | tr -d '\r\n')
LOGIN_STATUS=$(echo "${LOGIN_RESPONSE}" | tail -n 1)

if [ -z "${TOKEN}" ]; then
    echo ">>> ERROR: Failed to log in as admin (status: ${LOGIN_STATUS})."
    echo ">>> Cannot create team without admin token."
    echo ">>> You may need to create the team manually."
    exit 1
fi

echo ">>> Login successful, got admin token."

# Get the user ID from login if we don't have it
if [ -z "${USER_ID:-}" ]; then
    LOGIN_BODY=$(echo "${LOGIN_RESPONSE}" | grep "^{" | head -1)
    USER_ID=$(echo "${LOGIN_BODY}" | jq -r '.id' 2>/dev/null || echo "")
fi

# Create default team
echo ">>> Creating default team '${TEAM_NAME}'..."
TEAM_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SERVER_URL}/api/v4/teams" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "{
        \"name\": \"${TEAM_NAME}\",
        \"display_name\": \"${TEAM_DISPLAY}\",
        \"type\": \"O\"
    }" 2>/dev/null)

TEAM_BODY=$(echo "${TEAM_RESPONSE}" | head -n -1)
TEAM_STATUS=$(echo "${TEAM_RESPONSE}" | tail -n 1)

if [ "${TEAM_STATUS}" = "201" ]; then
    TEAM_ID=$(echo "${TEAM_BODY}" | jq -r '.id')
    echo ">>> Team created (id: ${TEAM_ID})."
elif echo "${TEAM_BODY}" | jq -r '.message' 2>/dev/null | grep -qi "exists"; then
    echo ">>> Team already exists."
    # Look up the team
    TEAM_ID=$(curl -s -H "Authorization: Bearer ${TOKEN}" "${SERVER_URL}/api/v4/teams/name/${TEAM_NAME}" 2>/dev/null | jq -r '.id')
    echo ">>> Existing team id: ${TEAM_ID}"
else
    echo ">>> Team creation returned status ${TEAM_STATUS}: ${TEAM_BODY}"
    TEAM_ID=""
fi

# Add admin to team (if both IDs are available)
if [ -n "${TEAM_ID:-}" ] && [ -n "${USER_ID:-}" ] && [ "${TEAM_ID}" != "null" ] && [ "${USER_ID}" != "null" ]; then
    echo ">>> Adding admin to team..."
    curl -s -X POST "${SERVER_URL}/api/v4/teams/${TEAM_ID}/members" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d "{\"team_id\": \"${TEAM_ID}\", \"user_id\": \"${USER_ID}\"}" \
        >/dev/null 2>&1 \
        && echo ">>> Admin added to team." \
        || echo ">>> Admin already in team (or add failed)."
fi

echo ""
echo ">>> Admin setup complete!"
echo ">>> Login at ${SERVER_URL}"
echo ">>>   Username: ${ADMIN_USERNAME}"
echo ">>>   Password: ${ADMIN_PASSWORD}"
echo ">>>   Team:     ${TEAM_NAME} (${TEAM_DISPLAY})"
