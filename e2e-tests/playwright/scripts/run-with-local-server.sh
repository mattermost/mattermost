#!/bin/bash
# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

# Script to run Playwright tests with a local Mattermost server using testcontainers for services.
# Usage: ./scripts/run-with-local-server.sh [playwright-args]
#        ./scripts/run-with-local-server.sh --stop  # Stop running services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLAYWRIGHT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PLAYWRIGHT_DIR/../../server"
TESTCONTAINERS_DIR="$PLAYWRIGHT_DIR/../testcontainers"
ENV_FILE="$PLAYWRIGHT_DIR/.env-tc"
TC_PID=""
SERVER_PID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[run-local]${NC} $1"
}

error() {
    echo -e "${RED}[run-local]${NC} $1" >&2
}

cleanup() {
    log "Cleaning up..."

    # Stop Mattermost server using make stop-server
    log "Stopping Mattermost server..."
    cd "$SERVER_DIR"
    make stop-server 2>/dev/null || true
    sleep 1

    # Stop testcontainers if running
    if [ -n "$TC_PID" ] && kill -0 "$TC_PID" 2>/dev/null; then
        log "Stopping testcontainers (PID: $TC_PID)"
        kill "$TC_PID" 2>/dev/null || true
        wait "$TC_PID" 2>/dev/null || true
    fi

    # Remove env file
    if [ -f "$ENV_FILE" ]; then
        rm -f "$ENV_FILE"
    fi

    log "Cleanup complete"
}

# Handle --stop option
if [ "$1" = "--stop" ]; then
    log "Stopping services..."
    # Stop server using make stop-server (works regardless of how it was started)
    log "Stopping Mattermost server..."
    cd "$SERVER_DIR"
    make stop-server 2>/dev/null || true
    # Also try to stop testcontainers CLI
    pkill -f "dist/cli.js start" 2>/dev/null || true
    if [ -f "$ENV_FILE" ]; then
        rm -f "$ENV_FILE"
    fi
    log "Done"
    exit 0
fi

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Check if server directory exists
if [ ! -d "$SERVER_DIR" ]; then
    error "Server directory not found: $SERVER_DIR"
    exit 1
fi

# Get services from TC_ENABLED_SERVICES or default
SERVICES="${TC_ENABLED_SERVICES:-postgres,inbucket}"

log "Starting testcontainers services: $SERVICES"

# Start testcontainers in background
cd "$TESTCONTAINERS_DIR"
node dist/cli.js start --local --output-env "$ENV_FILE" -s "$SERVICES" &
TC_PID=$!

# Wait for env file to be created (services ready)
log "Waiting for services to be ready..."
TIMEOUT=120
ELAPSED=0
while [ ! -f "$ENV_FILE" ] || [ ! -s "$ENV_FILE" ]; do
    if ! kill -0 "$TC_PID" 2>/dev/null; then
        error "Testcontainers process died unexpectedly"
        exit 1
    fi
    if [ $ELAPSED -ge $TIMEOUT ]; then
        error "Timeout waiting for services to start"
        exit 1
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

log "Services ready, env file created at $ENV_FILE"

# Source the environment variables (set -a exports all variables automatically)
set -a
source "$ENV_FILE"
set +a

# Debug: show database connection string
log "Database: $MM_SQLSETTINGS_DATASOURCE"

# Start the server (MM_NO_DOCKER=true skips docker-compose, testcontainers provides services)
log "Starting Mattermost server..."
cd "$SERVER_DIR"
make run-server &
SERVER_PID=$!

# Wait for server to be healthy
# Note: make run-server spawns go run in background and exits immediately,
# so we can't check SERVER_PID - just rely on curl health check timeout
log "Waiting for server to be healthy..."
SERVER_URL="http://localhost:8065"
TIMEOUT=120
ELAPSED=0
while ! curl -sf "$SERVER_URL/api/v4/system/ping" > /dev/null 2>&1; do
    if [ $ELAPSED -ge $TIMEOUT ]; then
        error "Timeout waiting for server to be healthy"
        exit 1
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

log "Server is healthy at $SERVER_URL"

# Run Playwright tests
log "Running Playwright tests..."
cd "$PLAYWRIGHT_DIR"
export PW_BASE_URL="$SERVER_URL"

# Pass any additional arguments to playwright
npx playwright test "$@"
TEST_EXIT_CODE=$?

log "Tests completed with exit code: $TEST_EXIT_CODE"
exit $TEST_EXIT_CODE
