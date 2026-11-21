#!/usr/bin/env bash
# Preflight on the real stack: the infra isolation gate with the input image, the licence check (PASS or FAIL only),
# and the check that the server inside the image reports the target commit. Then the stack is torn down, so the
# coordinator starts from a clean one. MM_LICENSE is read by name only and never printed.
#   stack_gate.sh [--dry-run]
# Exit 0 all pass, 1 a gate or licence failure, 3 blocked (no licence secret, or the build hash does not confirm).
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/ci_lib.sh"
parse_dry_run "$@"

image_ref="$(fact image.ref)"
export MATTERMOST_PILOT_IMAGE="$image_ref"

if [ "$DRY_RUN" = true ]; then
    echo "+ MATTERMOST_PILOT_IMAGE=<input image> bash explorer-proto/infra/scripts/gate.sh --keep"
    echo "+ node explorer-proto/v2/ci/verify_target.mjs live"
    echo "+ bash explorer-proto/infra/scripts/down.sh"
    exit 0
fi

if ! license_present; then
    status record gate BLOCKED "the licence secret is not available to this run"
    status record licence BLOCKED "the licence secret is not available to this run"
    echo "::error title=exploratory licence::BLOCKED: the licence secret is not available (fork or missing secret). This is not a pass."
    exit 3
fi

mkdir -p "$CI_DIR/logs"
gate_log="$CI_DIR/logs/gate.txt"
bash "$INFRA_SCRIPTS/gate.sh" --keep 2>&1 | tee "$gate_log"
gate_rc=${PIPESTATUS[0]}

rc=0
if [ "$gate_rc" -eq 0 ]; then
    status record gate PASS "gate.sh --keep exit 0"
else
    status record gate FAIL "gate.sh --keep exit $gate_rc"
    rc=1
fi

if grep -qF "IsLicensed === 'true': PASS" "$gate_log"; then
    status record licence PASS "IsLicensed === 'true'"
    if node "$CI_LIB_DIR/verify_target.mjs" live; then
        status record provenance-live PASS "the server build hash confirms the target"
    else
        status record provenance-live BLOCKED "the server build hash does not confirm the target"
        rc=3
    fi
else
    status record licence FAIL "IsLicensed === 'true' was not confirmed"
    status record provenance-live SKIPPED "the stack was not licensed or not ready"
    rc=1
fi

if ! bash "$INFRA_SCRIPTS/down.sh"; then
    echo "::error title=exploratory::the preflight teardown failed"
    rc=1
fi
exit "$rc"
