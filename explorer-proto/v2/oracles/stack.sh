#!/usr/bin/env bash
# Thin wrapper around the existing infra scripts so the Mattermost image ref can come from the environment,
# without editing infra. Never prints the base URL, a port or the license; never runs `docker compose config`.
#   explorer-proto/v2/oracles/stack.sh up [--variant=...] [--session=bookmarks]
#   explorer-proto/v2/oracles/stack.sh down
#   ORACLE_MM_IMAGE=<repo:tag@sha256:...>  overrides only the Mattermost image (it must already be pulled).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/../../infra/scripts/lib.sh"

cmd="${1:-}"
shift || true

if [ -n "${ORACLE_MM_IMAGE:-}" ]; then
    if ! [[ "$ORACLE_MM_IMAGE" =~ ^[A-Za-z0-9._/-]+(:[A-Za-z0-9._-]+)?(@sha256:[0-9a-f]{64})?$ ]]; then
        echo "ORACLE_MM_IMAGE is not a plain image reference" >&2
        exit 2
    fi
    mkdir -p "$HERE/.run"
    OVERRIDE="$HERE/.run/image-override.yml"
    printf 'services:\n  mattermost:\n    image: %s\n' "$ORACLE_MM_IMAGE" >"$OVERRIDE"
    COMPOSE=(docker compose -f "$INFRA_DIR/docker-compose.yml" -f "$OVERRIDE")
fi

case "$cmd" in
up)
    license_present || { echo "MM_LICENSE is not set in this shell; refusing to start" >&2; exit 1; }
    stack_up || { echo "stack failed to become ready" >&2; exit 1; }
    start_forwarder || { echo "forwarder failed to reach Mattermost" >&2; exit 1; }
    if node "$SCRIPTS_DIR/probe.mjs" license "$BASE_URL"; then
        echo "IsLicensed === 'true': PASS"
    else
        echo "IsLicensed === 'true': FAIL" >&2
        exit 1
    fi
    PW_BASE_URL="$BASE_URL" node "$SCRIPTS_DIR/seed.mjs" "$@" >/dev/null
    echo "ready (image: ${ORACLE_MM_IMAGE:-pinned compose default})"
    ;;
down)
    bash "$SCRIPTS_DIR/down.sh"
    ;;
*)
    echo "usage: stack.sh up [--variant=...] [--session=bookmarks] | down" >&2
    exit 2
    ;;
esac
