#!/usr/bin/env bash
# Runs the coordinator headlessly, exactly as the "Headless CI entry" of explorer-proto/v2/orchestrator/README.md
# documents: `pilot.mjs doctor`, then `pilot.mjs run --live --verifier=process`. Both are in this one step because both
# need MM_LICENSE (doctor checks it by name, the run starts the stack). The verifier is a child process of the run and
# inherits the same environment, so it is not a separate credential domain. No model agent is started.
# Exit codes of `run` (mapped by coordinator_plan.mjs): 0 PASS, 1 FAIL, 2 usage (a workflow bug, FAIL), 3 BLOCKED,
# 30 PENDING (incomplete), 20/21/22 FAIL (agent codes, not expected with --verifier=process), a timeout FAIL.
#   run_coordinator.sh [--dry-run]
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/ci_lib.sh"
parse_dry_run "$@"

plan() { node "$CI_LIB_DIR/coordinator_plan.mjs" "$@"; }

kind="$(fact target_kind)"
image_ref="$(fact image.ref)"
run_id="$(fact run_id)"
verify_spec="$(fact verify_spec)"
session="$(fact session)"
control="$(fact control)"
budget_minutes="$(fact time_budget_minutes)"
started="$(fact started_epoch_s)"
reserve="$(plan reserve-seconds)"

doctor_cmd=(node "$PILOT" doctor --image "$image_ref")
run_cmd() {
    cmd=(node "$PILOT" run
        --target "$kind" --live --verifier=process
        --run-id "$run_id" --verify-spec "$verify_spec" --engine-charter "session:$session" --control "$control"
        --image "$image_ref" --verifier-timeout "$1")
}

if [ "$DRY_RUN" = true ]; then
    window=$((budget_minutes * 60 - reserve))
    verifier_timeout="$(plan verifier-timeout --window "$window")" || exit 1
    run_cmd "$verifier_timeout"
    echo "+ ${doctor_cmd[*]}"
    echo "+ ${cmd[*]}"
    exit 0
fi

if ! license_present; then
    status record coordinator BLOCKED "the licence secret is not available to this run"
    echo "::error title=exploratory licence::BLOCKED: the licence secret is not available. This is not a pass."
    exit 3
fi

# The coordinator gets what is left of the budget minus the reserve for teardown, export, scan, upload and summary.
remaining=$((started + budget_minutes * 60 - $(date +%s) - reserve))
mkdir -p "$CI_DIR/logs"
if ! verifier_timeout="$(plan verifier-timeout --window "$remaining" 2>"$CI_DIR/logs/budget-reason.txt")"; then
    status record coordinator FAIL "the time budget left too little for the verifier"
    echo "::error title=exploratory coordinator::FAIL: the time budget was used up before the coordinator could start ($(tr '\n' ' ' <"$CI_DIR/logs/budget-reason.txt"))"
    exit 1
fi

cd "$REPO_ROOT"
doctor_log="$CI_DIR/logs/doctor.txt"
echo "::group::pilot.mjs doctor"
"${doctor_cmd[@]}" 2>&1 | tee "$doctor_log"
doctor_rc=${PIPESTATUS[0]}
echo "::endgroup::"
doctor_detail="$(plan doctor-summary "$doctor_log")"
case "$doctor_rc" in
0)
    status record doctor PASS "exit 0: $doctor_detail"
    ;;
3)
    status record doctor BLOCKED "exit 3: $doctor_detail"
    status record coordinator SKIPPED "the preflight did not pass"
    echo "::error title=exploratory doctor::BLOCKED: the coordinator preflight failed ($doctor_detail). This is not a pass."
    exit 3
    ;;
*)
    status record doctor FAIL "exit $doctor_rc: $doctor_detail"
    status record coordinator SKIPPED "the preflight did not pass"
    echo "::error title=exploratory doctor::FAIL: pilot.mjs doctor exited $doctor_rc (a usage error is a workflow bug)"
    exit 1
    ;;
esac

run_cmd "$verifier_timeout"
timeout --signal=TERM --kill-after=30 "${remaining}s" "${cmd[@]}"
rc=$?

status record coordinator "$(plan map-exit "$rc" --field result)" "$(plan map-exit "$rc" --field detail)"
if [ "$rc" -eq 0 ]; then
    exit 0
fi
echo "::error title=exploratory coordinator::$(plan map-exit "$rc" --field message)"
exit "$(plan map-exit "$rc" --field exit)"
