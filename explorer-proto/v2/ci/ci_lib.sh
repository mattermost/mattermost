# Shared helpers for the exploratory CI scripts. Source, do not execute.
# Never add `set -x` here or in callers: MM_LICENSE is in the environment of the steps that start the stack.

CI_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$CI_LIB_DIR/../../.." && pwd)"
CI_DIR="${EXPLORER_CI_DIR:-$REPO_ROOT/explorer-proto/infra/.run/ci}"
export EXPLORER_CI_DIR="$CI_DIR"
# EXPLORER_CI_INFRA_SCRIPTS and EXPLORER_CI_PILOT are test seams for selftest.mjs; the workflow sets neither.
INFRA_SCRIPTS="${EXPLORER_CI_INFRA_SCRIPTS:-$REPO_ROOT/explorer-proto/infra/scripts}"
PILOT="${EXPLORER_CI_PILOT:-$REPO_ROOT/explorer-proto/v2/orchestrator/pilot.mjs}"
EXPECTED_PG_IMAGE='postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5'
DRY_RUN=false

parse_dry_run() {
    local arg
    for arg in "$@"; do
        if [ "$arg" = --dry-run ]; then
            DRY_RUN=true
        fi
    done
}

# act <command...>: prints the command, and runs it unless --dry-run.
act() {
    echo "+ $*"
    if [ "$DRY_RUN" = true ]; then
        return 0
    fi
    "$@"
}

status() { node "$CI_LIB_DIR/ci_status.mjs" "$@"; }
fact() { node "$CI_LIB_DIR/run_facts.mjs" get "$1"; }
fail() {
    echo "::error title=exploratory::$*"
    return 1
}

# Checks the variable is exported without reading it out.
license_present() { node -e 'process.exit(process.env.MM_LICENSE ? 0 : 1)'; }
