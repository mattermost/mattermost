#!/usr/bin/env bash
# Local-fixture containment checks of the engine. They start their own loopback servers, need no Docker and no stack,
# and run without MM_LICENSE in the environment. Each result is recorded as its own stage.
#   containment.sh [--dry-run]
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/ci_lib.sh"
parse_dry_run "$@"

run_stage() {
    local stage=$1
    shift
    if [ "$DRY_RUN" = true ]; then
        echo "+ [stage $stage] $*"
        return 0
    fi
    status run "$stage" -- "$@"
}

rc=0
run_stage containment node explorer-proto/src/cli.ts guard-check || rc=1
run_stage containment-journey node explorer-proto/src/cli.ts guard-journey --journey=auto-follow || rc=1
exit "$rc"
