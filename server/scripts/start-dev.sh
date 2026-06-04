#!/usr/bin/env bash
# Stop prior local Mattermost processes, reset demo data, then start server + webapp
# (native Homebrew Postgres, no Docker).
#
# Usage (from anywhere):
#   server/scripts/start-dev.sh              # reset demo + start dev (default)
#   server/scripts/start-dev.sh --no-reset   # start dev only
#   server/scripts/start-dev.sh --reset-only # reset demo only (no webpack)
#
# Also available: server/scripts/reset-demo.sh (alias for --reset-only)
#
# Server:  http://localhost:8065
# Webapp:  http://localhost:9005  (webpack dev server; proxies API to :8065)

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
SERVER_DIR="$(cd -- "$SCRIPT_DIR/.." &>/dev/null && pwd)"
REPO_DIR="$(cd -- "$SERVER_DIR/.." &>/dev/null && pwd)"

RESET_DEMO=true
START_DEV=true

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

  (default)     Reset demo data, then start server + webpack dev server
  --no-reset    Start server + webpack without resetting demo data
  --reset-only  Reset demo data and exit (starts server if needed, no webpack)
  -h, --help    Show this help
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --no-reset)
            RESET_DEMO=false
            ;;
        --reset-only)
            START_DEV=false
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf 'Unknown option: %s\n' "$1" >&2
            usage >&2
            exit 1
            ;;
    esac
    shift
done

log()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }

export MM_NO_DOCKER=true
export RUN_SERVER_IN_BACKGROUND=true
export DEMO_SERVER_DIR="$SERVER_DIR"

# shellcheck source=reset-demo.lib.sh
source "$SCRIPT_DIR/reset-demo.lib.sh"

cd "$SERVER_DIR"

log "Restoring tracked files in repo (git restore .)"
git -C "$REPO_DIR" restore .
ok "Working tree restored"

log "Stopping prior Mattermost dev processes"
make stop >/dev/null 2>&1 || true
ok "Stopped server, webapp, and skipped docker"

if [ "$RESET_DEMO" = true ]; then
    reset_demo_data
fi

if [ "$START_DEV" = false ]; then
    print_demo_ready_message "http://localhost:8065"
    printf '\nRe-run %s to start webpack, or run without --reset-only.\n' "$(basename "$0")"
    exit 0
fi

log "Starting Mattermost (server in background, webapp in foreground)"
printf '  MM_NO_DOCKER=%s  RUN_SERVER_IN_BACKGROUND=%s\n' "$MM_NO_DOCKER" "$RUN_SERVER_IN_BACKGROUND"
printf '\n  Server: http://localhost:8065\n  Webapp: http://localhost:9005\n  Stop:   cd %s && MM_NO_DOCKER=true make stop\n' "$SERVER_DIR"

if [ "$RESET_DEMO" = true ]; then
    print_demo_ready_message "http://localhost:9005"
    printf '\n'
fi

if [ "$RESET_DEMO" = true ] && demo_mattermost_ping; then
    exec make run-client
fi

exec make run
