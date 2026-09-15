#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
TYPES_DIR="$REPO_ROOT/webapp/platform/types"
CLIENT_DIR="$REPO_ROOT/webapp/platform/client"

# `@mattermost/client` is installed via file: and symlinked to webapp/platform/client.
# Node resolves modules from that realpath, so playwright's node_modules/@mattermost/types
# is not visible to the client. CI gets the peer via `webapp` workspace install; for a
# playwright-only install, mirror it here.
mkdir -p "$CLIENT_DIR/node_modules/@mattermost"
ln -sfn ../../../types "$CLIENT_DIR/node_modules/@mattermost/types"

if [[ ! -f "$TYPES_DIR/lib/client4.js" || ! -f "$CLIENT_DIR/lib/index.js" ]]; then
    echo "error: @mattermost/types and @mattermost/client must be built before Playwright can run."
    echo "  From the repo root: (cd webapp && npm i)"
    echo "  That installs workspaces and builds platform/types + platform/client."
    exit 1
fi

if [ -n "${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-}" ]; then
    echo "Skipped browsers download for Playwright"
    exit 0
fi

# Install needed Playwright browsers only -- chromium and firefox only for these are the ones being used by the tests.
# May add more browsers in the future.
# https://playwright.dev/docs/library#browser-downloads
npx playwright install chromium
npx playwright install firefox
