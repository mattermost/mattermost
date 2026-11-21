#!/usr/bin/env bash
# Playwright workspace for the coordinator, set up the way the e2e workflows do it: `npm ci` in e2e-tests/playwright (no
# global install), lockfiles unchanged afterwards, Chromium only, the git-ignored explorer-proto/node_modules symlink,
# then the toolchain facts. Run after ./.github/actions/webapp-setup (it builds the packages `npm ci` links to).
#   setup_workspace.sh [--dry-run]
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/ci_lib.sh"
parse_dry_run "$@"

cd "$REPO_ROOT"
want_node="v$(tr -d '[:space:]' <.nvmrc)"
if [ "$(node --version)" != "$want_node" ]; then
    if [ "$DRY_RUN" = true ]; then
        echo "note: node $(node --version) differs from .nvmrc ($want_node); a real run stops here"
    else
        fail "node $(node --version) differs from .nvmrc ($want_node)"
    fi
fi

(
    cd e2e-tests/playwright
    export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
    act npm ci
)
act git diff --exit-code -- ':(glob)**/package-lock.json'

(
    cd e2e-tests/playwright
    act npx playwright install chromium
)

link="$REPO_ROOT/explorer-proto/node_modules"
if [ -e "$link" ] && [ ! -L "$link" ]; then
    fail "explorer-proto/node_modules exists and is not a symlink"
fi
act ln -sfn ../e2e-tests/playwright/node_modules "$link"

if [ "$DRY_RUN" = true ]; then
    echo "+ node explorer-proto/v2/ci/run_facts.mjs toolchain"
else
    node "$CI_LIB_DIR/run_facts.mjs" toolchain
fi
