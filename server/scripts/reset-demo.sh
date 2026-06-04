#!/usr/bin/env bash
# Reset demo data only. For reset + dev server, use start-dev.sh (default).
#
# Usage:
#   server/scripts/reset-demo.sh
#   ./server/scripts/start-dev.sh --reset-only

set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
exec "$SCRIPT_DIR/start-dev.sh" --reset-only
