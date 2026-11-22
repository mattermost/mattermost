#!/usr/bin/env bash
# Builds the one directory the workflow uploads: the coordinator's sanitized export plus ci/ (run facts, stage ledger,
# provenance). The coordinator's summary goes to a file beside it, not into the export. `pilot.mjs export` scans its copy
# for the licence itself and fails closed (exit 3, nothing exported) without MM_LICENSE, so this step receives it.
# Exit codes of `export`: 0 PASS, 1 FAIL (leak scan found something), 2 usage, 3 BLOCKED (no licence to scan with).
#   export_run.sh [--dry-run]
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/ci_lib.sh"
parse_dry_run "$@"

out="$CI_DIR/export"
summary_file="$CI_DIR/pilot-summary.md"
run_id="$(fact run_id 2>/dev/null || true)"

export_cmd=(node "$PILOT" export --run-id "${run_id:-<run id>}" --out "$out")
summary_cmd=(node "$PILOT" summary --run-id "${run_id:-<run id>}" --github)

if [ "$DRY_RUN" = true ]; then
    echo "+ ${export_cmd[*]}"
    echo "+ ${summary_cmd[*]} > $summary_file"
    echo "+ node explorer-proto/v2/ci/assert_no_capture.mjs --export $out"
    exit 0
fi

rm -rf "$out" "$summary_file"
rc=0
if [ -z "$run_id" ]; then
    rc=1
    echo "no run id: the workflow inputs were not accepted"
    printf 'The coordinator summary is unavailable (no run).\n' >"$summary_file"
    status record export FAIL "no run id"
elif [ ! -f "$REPO_ROOT/explorer-proto/infra/.run/orch/$run_id/run.json" ]; then
    echo "the coordinator never created run $run_id: nothing to export"
    printf 'The coordinator summary is unavailable (the coordinator never started).\n' >"$summary_file"
    status record export SKIPPED "the coordinator never created its run directory"
else
    "${export_cmd[@]}" || rc=$?
    "${summary_cmd[@]}" >"$summary_file" || printf 'The coordinator summary is unavailable (summary exited %s).\n' "$?" >"$summary_file"
    case "$rc" in
    0) status record export PASS "exit 0" ;;
    1) status record export FAIL "pilot.mjs export exit 1: the leak scan failed and nothing was exported" ;;
    2) status record export FAIL "pilot.mjs export exit 2: usage error (a workflow bug)" ;;
    3) status record export BLOCKED "pilot.mjs export exit 3: no licence to scan with, nothing was exported" ;;
    *) status record export FAIL "pilot.mjs export exit $rc" ;;
    esac
fi

mkdir -p "$out/ci"
for file in run-facts.json ci-status.json provenance.json; do
    if [ -f "$CI_DIR/$file" ]; then
        cp "$CI_DIR/$file" "$out/ci/$file"
    fi
done

status run capture-export -- node "$CI_LIB_DIR/assert_no_capture.mjs" --export "$out" || rc=1
exit "$rc"
