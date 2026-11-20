#!/usr/bin/env bash
# Idempotent teardown: forwarder, stack containers + network + anonymous volumes, gate canary, seed manifest.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

canary_down
stack_down
echo "down"
