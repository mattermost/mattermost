#!/usr/bin/env bash
# Start the pilot stack and the loopback forwarder. Prints the base URL on success.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

if ! license_present; then
    echo "MM_LICENSE is not set in this shell; refusing to start" >&2
    exit 1
fi

stack_up || { echo "stack failed to become ready" >&2; exit 1; }
start_forwarder || { echo "forwarder failed to reach Mattermost" >&2; exit 1; }
echo "ready: $BASE_URL"
