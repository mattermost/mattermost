#!/usr/bin/env bash
set -euo pipefail

# ============================================
# PATH setup
# Docker ENV vars may not carry through to the
# shell when Cursor runs start scripts.
# ============================================
export GOPATH="${GOPATH:-/home/ubuntu/go}"
export PATH="/usr/local/go/bin:${GOPATH}/bin:/usr/local/bin:${PATH}"
export MM_NO_DOCKER=true

echo ">>> Mattermost Cursor Agent: start.sh"

WORKSPACE_ROOT="$(pwd)"

# ============================================
# Start PostgreSQL
# On Ubuntu, apt-get install postgresql-14
# auto-creates a cluster. Verify it exists
# and start it.
# ============================================
echo ">>> Starting PostgreSQL..."

# Verify cluster exists (safety check)
if ! sudo pg_lsclusters -h | grep -q "14.*main"; then
    echo ">>> No PostgreSQL 14 cluster found, creating one..."
    sudo pg_createcluster 14 main
fi

sudo pg_ctlcluster 14 main start 2>/dev/null || true

# Wait for PostgreSQL to be ready
echo ">>> Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
    if sudo -u postgres pg_isready -q 2>/dev/null; then
        echo ">>> PostgreSQL is ready."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo ">>> WARNING: PostgreSQL did not become ready in time."
    fi
    sleep 1
done

# Create dev database and user (idempotent)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'mostest';" 2>/dev/null || true
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='mmuser'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE USER mmuser WITH PASSWORD 'mostest' SUPERUSER CREATEDB;" 2>/dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='mattermost_test'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE DATABASE mattermost_test OWNER mmuser;" 2>/dev/null

# ============================================
# Start Redis
# Using service command which reads the system
# config at /etc/redis/redis.conf.
# ============================================
echo ">>> Starting Redis..."
sudo service redis-server start 2>/dev/null || true

# Wait for Redis to be ready
for i in $(seq 1 10); do
    if redis-cli ping 2>/dev/null | grep -q PONG; then
        echo ">>> Redis is ready."
        break
    fi
    if [ "$i" -eq 10 ]; then
        echo ">>> WARNING: Redis did not become ready in time."
    fi
    sleep 1
done

# ============================================
# Install tmux if not present
# Required for managing server process in a
# named session. The Dockerfile should include
# it, but this is a safety net.
# ============================================
if ! command -v tmux &>/dev/null; then
    echo ">>> Installing tmux..."
    sudo apt-get update -qq && sudo apt-get install -y -qq tmux 2>/dev/null
fi

# ============================================
# Ensure server/client symlink exists
# If webapp was pre-built during install but
# the symlink is missing, create it.
# ============================================
if [ -d "${WORKSPACE_ROOT}/webapp/channels/dist" ] && [ ! -e "${WORKSPACE_ROOT}/server/client" ]; then
    echo ">>> Creating server/client symlink..."
    cd "${WORKSPACE_ROOT}/server"
    ln -nfs ../webapp/channels/dist client
fi

# ============================================
# Ensure wt CLI is installed
# Safety net in case install.sh didn't run or
# the symlink was lost.
# ============================================
if [ -f "${WORKSPACE_ROOT}/.cursor/wt" ] && ! command -v wt &>/dev/null; then
    chmod +x "${WORKSPACE_ROOT}/.cursor/wt"
    sudo ln -sf "${WORKSPACE_ROOT}/.cursor/wt" /usr/local/bin/wt
fi

# ============================================
# Ensure Go workspace is set up
# go.work is gitignored and may not exist yet.
# ============================================
if [ ! -f "${WORKSPACE_ROOT}/server/go.work" ]; then
    echo ">>> Setting up Go workspace..."
    cd "${WORKSPACE_ROOT}/server" && make setup-go-work 2>/dev/null || true
fi

# ============================================
# Background: Admin user + team setup
# Launches a background process that waits for
# the server to become healthy, then creates
# the admin user and default team via REST API.
# This runs asynchronously so start.sh doesn't
# block on the server starting.
# ============================================
echo ">>> Launching background admin setup (will run when server is ready)..."
(
    cd "${WORKSPACE_ROOT}"
    bash .cursor/setup-admin.sh >> /tmp/mattermost-admin-setup.log 2>&1
) &
ADMIN_SETUP_PID=$!
echo ">>> Admin setup running in background (PID: ${ADMIN_SETUP_PID})"
echo ">>> Logs at /tmp/mattermost-admin-setup.log"

# ============================================
# NOTE: Chrome is NOT started here.
# agent-browser manages its own Chromium
# lifecycle on-demand. Chromium binaries are
# pre-installed during the install phase.
# ============================================

echo ""
echo ">>> All services started!"
echo ">>> PostgreSQL: localhost:5432 (mmuser:mostest / mattermost_test)"
echo ">>> Redis:      localhost:6379"
echo ""
echo ">>> The Mattermost server will start automatically in the 'Mattermost Server' terminal."
echo ">>> Admin user will be created automatically when the server is ready."
echo ">>>   Username: admin"
echo ">>>   Password: Passw0rd!"
echo ">>>   Team:     dev (Development)"
echo ""
echo ">>> To check admin setup progress:"
echo ">>>   cat /tmp/mattermost-admin-setup.log"
