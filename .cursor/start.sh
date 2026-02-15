#!/usr/bin/env bash
set -euo pipefail

echo ">>> Mattermost Cursor Agent: start.sh"

# Ensure MM_NO_DOCKER is set for any ad-hoc make commands
export MM_NO_DOCKER=true

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

sudo pg_ctlcluster 14 main start

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
# Using 2>/dev/null || true so these don't fail if already exist
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
sudo service redis-server start

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
# NOTE: Chrome is NOT started here.
# agent-browser manages its own Chromium
# lifecycle on-demand. This saves memory when
# the agent doesn't need browser access.
# ============================================

echo ""
echo ">>> All services started!"
echo ">>> PostgreSQL: localhost:5432 (mmuser:mostest / mattermost_test)"
echo ">>> Redis:      localhost:6379"
echo ""
echo ">>> To start the Mattermost server, use the terminal command:"
echo ">>>   cd server && make cursor-cloud-run-server"
echo ""
echo ">>> To create the admin user (after server is running):"
echo ">>>   bash .cursor/setup-admin.sh"
