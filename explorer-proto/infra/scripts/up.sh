#!/usr/bin/env bash
# Start the pilot stack and the loopback forwarder, then seed. Prints the base URL on success.
#   up.sh [--variant=default|swap-purpose-header|no-archive] [--session=bookmarks] [--target=default|main|release-X.Y.Z] [--no-seed]
set -euo pipefail
source "$(dirname "$0")/lib.sh"

SEED_ARGS=()
SEED=true
SESSION=""
TARGET=""
for arg in "$@"; do
    case "$arg" in
    --variant=*) SEED_ARGS+=("$arg") ;;
    --session=bookmarks) SESSION=bookmarks; SEED_ARGS+=("$arg") ;;
    --target=*) TARGET="${arg#--target=}" ;;
    --no-seed) SEED=false ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
    esac
done

if ! license_present; then
    echo "MM_LICENSE is not set in this shell; refusing to start" >&2
    exit 1
fi

[ -z "$TARGET" ] || apply_target "$TARGET" || exit $?
verify_images || exit 1
stack_up || { echo "stack failed to become ready" >&2; exit 1; }
start_forwarder || { echo "forwarder failed to reach Mattermost" >&2; exit 1; }
if [ -n "$SESSION" ]; then
    if node "$SCRIPTS_DIR/probe.mjs" license "$BASE_URL"; then
        echo "IsLicensed === 'true': PASS"
    else
        echo "IsLicensed === 'true': FAIL (setup failure: licence/bookmarks; session $SESSION needs a licensed server)" >&2
        exit 1
    fi
fi
if [ "$SEED" = true ]; then
    PW_BASE_URL="$BASE_URL" node "$SCRIPTS_DIR/seed.mjs" ${SEED_ARGS[@]+"${SEED_ARGS[@]}"}
fi
echo "ready: $BASE_URL"
