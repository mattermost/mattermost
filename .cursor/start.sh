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
# Ensure air is installed
# install.sh should have installed it, but if
# the Go version changed or binary is missing,
# install a compatible version as a safety net.
# ============================================
if ! command -v air &>/dev/null; then
    echo ">>> Installing air (Go hot-reload)..."
    go install github.com/air-verse/air@v1.61.7
fi

# ============================================
# NOTE: Chrome is NOT started here.
# agent-browser manages its own Chromium
# lifecycle on-demand. This saves memory when
# the agent doesn't need browser access.
# ============================================

# ============================================
# mmctl socket symlink
# The config uses a custom socket path
# (/var/tmp/mattermost_cursor_cloud.sock) but
# mmctl --local expects the default path.
# Create a symlink so mmctl works out of the box.
# ============================================
echo ">>> Creating mmctl socket symlink..."
ln -sf /var/tmp/mattermost_cursor_cloud.sock /var/tmp/mattermost_local.socket

# ============================================
# AWS CLI configuration
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and
# AWS_S3_BUCKET_NAME are injected as env vars
# by Cursor Cloud Agent. Set a default region
# so the CLI works without interactive prompts.
# ============================================
if command -v aws &>/dev/null && [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
    echo ">>> Configuring AWS CLI..."
    aws configure set default.region "${AWS_DEFAULT_REGION:-us-east-1}"
    aws configure set default.output json
    echo ">>> AWS CLI configured (region: ${AWS_DEFAULT_REGION:-us-east-1})."
else
    echo ">>> AWS CLI not configured (missing binary or credentials)."
fi

# ============================================
# Enable Claude documentation
# Copies CLAUDE.OPTIONAL.md files to CLAUDE.md
# throughout the repo for local-only docs.
# ============================================
if [ -x "${WORKSPACE_ROOT}/enable-claude-docs.sh" ]; then
    echo ">>> Enabling Claude documentation..."
    bash "${WORKSPACE_ROOT}/enable-claude-docs.sh"
fi

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
