#!/usr/bin/env bash
# Builds the one directory the workflow uploads: the coordinator's sanitized export plus ci/ (run facts, stage ledger,
# provenance). The coordinator's summary goes to a file beside it, not into the export. Nothing here needs MM_LICENSE.
#   export_run.sh [--dry-run]
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/ci_lib.sh"
parse_dry_run "$@"

out="$CI_DIR/export"
summary_file="$CI_DIR/pilot-summary.md"
run_id="$(fact run_id 2>/dev/null || true)"

if [ "$DRY_RUN" = true ]; then
    echo "+ node explorer-proto/v2/orchestrator/pilot.mjs export --run-id ${run_id:-<run id>} --out <ci dir>/export"
    echo "+ node explorer-proto/v2/orchestrator/pilot.mjs summary --run-id ${run_id:-<run id>} --github > <ci dir>/pilot-summary.md"
    echo "+ node explorer-proto/v2/ci/assert_no_capture.mjs --export <ci dir>/export"
    exit 0
fi

rm -rf "$out" "$summary_file"
rc=0
if [ -n "$run_id" ]; then
    node "$PILOT" export --run-id "$run_id" --out "$out" || rc=$?
    node "$PILOT" summary --run-id "$run_id" --github >"$summary_file" || printf 'The coordinator summary is unavailable (summary exited %s).\n' "$?" >"$summary_file"
else
    rc=1
    echo "no run id: the workflow inputs were not accepted"
    printf 'The coordinator summary is unavailable (no run).\n' >"$summary_file"
fi

if [ "$rc" -eq 0 ]; then
    status record export PASS "exit 0"
else
    status record export FAIL "pilot.mjs export exit $rc"
fi

mkdir -p "$out/ci"
for file in run-facts.json ci-status.json provenance.json; do
    if [ -f "$CI_DIR/$file" ]; then
        cp "$CI_DIR/$file" "$out/ci/$file"
    fi
done

status run capture-export -- node "$CI_LIB_DIR/assert_no_capture.mjs" --export "$out" || rc=1
exit "$rc"
