#!/usr/bin/env bash
# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.
#
# Gap 11: migrated specs need a webapp built from THIS branch, because the shared 12.x test server does not render
# data-surface. This script builds the webapp from the branch, boots a Testcontainers server, and runs one migrated
# spec against it. It needs Docker (Testcontainers) and a webapp build (~several minutes, multiple GB), so it is not
# part of CI; run it locally to prove a migrated spec passes end to end.
#
# Usage: ui-surface/scripts/run-migrated-spec.sh [spec-path]
set -euo pipefail

SPEC="${1:-specs/functional/channels/channel_settings/channel_headers.spec.ts}"
PW_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
REPO_ROOT="$(cd "$PW_DIR/../.." && pwd)"

echo "==> Building the webapp from this branch (provides data-surface)"
cd "$REPO_ROOT/webapp"
make build        # or: make dist, depending on how the server is served

echo "==> Building the Playwright workspace (regenerates the typed surface from the branch)"
cd "$PW_DIR"
npm ci --ignore-scripts
npm run build --workspace @mattermost/ui-surface
node ui-surface/bin/ui-surface.mjs generate
npm run build

echo "==> Running one migrated spec against a Testcontainers server built from the branch webapp"
# PW_USE_TESTCONTAINERS boots a server image; point it at the branch build per e2e-tests/playwright/lib/README.md.
PW_USE_TESTCONTAINERS=true npx playwright test "$SPEC" --project=chrome

echo "==> Done. A green result proves the migrated spec passes against a branch-built webapp."
