#!/usr/bin/env bash
# Stop the forwarder and remove the pilot stack including its anonymous volumes.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

stack_down
echo "down"
