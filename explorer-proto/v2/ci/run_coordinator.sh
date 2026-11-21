#!/usr/bin/env bash
# Runs the real coordinator headlessly (the "Headless CI entry" contract of explorer-proto/v2/orchestrator) and maps its
# exit code to the stage ledger: 0 PASS, 1 FAIL, 3 BLOCKED, 30 PENDING (incomplete), a timeout FAIL, anything else FAIL.
# No model agent is started: --verifier=process delivers the verification to deterministic code. MM_LICENSE is
# inherited by the coordinator and never printed.
#   run_coordinator.sh [--dry-run]
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/ci_lib.sh"
parse_dry_run "$@"

kind="$(fact target_kind)"
image_ref="$(fact image.ref)"
run_id="$(fact run_id)"
verify_spec="$(fact verify_spec)"
session="$(fact session)"
control="$(fact control)"
budget_minutes="$(fact time_budget_minutes)"
started="$(fact started_epoch_s)"

cmd=(node "$PILOT" run
    --target "$kind" --live --verifier=process --image "$image_ref" --run-id "$run_id"
    --verify-spec "$verify_spec" --engine-charter "session:$session" --control "$control")

if [ "$DRY_RUN" = true ]; then
    echo "+ ${cmd[*]}"
    exit 0
fi

if ! license_present; then
    status record coordinator BLOCKED "the licence secret is not available to this run"
    echo "::error title=exploratory licence::BLOCKED: the licence secret is not available. This is not a pass."
    exit 3
fi

# Keep ten minutes of the budget for teardown, export, scan, upload and the summary.
reserve=600
remaining=$((started + budget_minutes * 60 - $(date +%s) - reserve))
if [ "$remaining" -lt 120 ]; then
    status record coordinator FAIL "the time budget was used up before the coordinator could start"
    echo "::error title=exploratory coordinator::FAIL: the time budget was used up before the coordinator could start"
    exit 1
fi

cd "$REPO_ROOT"
timeout --signal=TERM --kill-after=30 "${remaining}s" "${cmd[@]}"
rc=$?

case "$rc" in
0)
    status record coordinator PASS "exit 0"
    exit 0
    ;;
1) message="FAIL: a coordinator stage failed (exit 1)" result=FAIL ;;
3) message="BLOCKED: a precondition is missing or a gate could not run (exit 3). This is not a pass." result=BLOCKED ;;
30) message="PENDING: the run is incomplete (exit 30). This is not a pass." result=PENDING ;;
124 | 137)
    message="FAIL: the time budget ran out (exit $rc)"
    result=FAIL
    rc=1
    ;;
*) message="FAIL: unexpected coordinator exit $rc (--verifier=process starts no agent, so 20, 21 and 22 are not expected)" result=FAIL ;;
esac
status record coordinator "$result" "exit $rc"
echo "::error title=exploratory coordinator::$message"
exit "$rc"
