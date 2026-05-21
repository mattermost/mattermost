#!/usr/bin/env bash
# Stop any prior local Mattermost dev instance, then start server + webapp
# without Docker (native Homebrew Postgres).
#
# Usage (from anywhere):
#   server/scripts/start-dev.sh
#   ./scripts/start-dev.sh          # from server/
#
# Stops: go run / go-build mattermost processes and webpack dev server.
# Starts: MM_NO_DOCKER=true RUN_SERVER_IN_BACKGROUND=true make run
#
# Server:  http://localhost:8065
# Webapp:  http://localhost:9005  (webpack dev server; proxies API to :8065)

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
SERVER_DIR="$(cd -- "$SCRIPT_DIR/.." &>/dev/null && pwd)"

log()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

export MM_NO_DOCKER=true
export RUN_SERVER_IN_BACKGROUND=true

cd "$SERVER_DIR"

log "Stopping prior Mattermost dev processes"
make stop >/dev/null 2>&1 || true
ok "Stopped server, webapp, and skipped docker"

log "Starting Mattermost (server in background, webapp in foreground)"
printf '  MM_NO_DOCKER=%s  RUN_SERVER_IN_BACKGROUND=%s\n' "$MM_NO_DOCKER" "$RUN_SERVER_IN_BACKGROUND"
printf '\n  Server: http://localhost:8065\n  Webapp: http://localhost:9005\n  Stop:   cd %s && MM_NO_DOCKER=true make stop\n\n' "$SERVER_DIR"

exec make run
