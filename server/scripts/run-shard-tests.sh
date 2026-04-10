#!/bin/bash
set -uo pipefail

# run-shard-tests.sh — Multi-run test wrapper for sharded CI
#
# When a shard has both "light" packages (run whole) and "heavy" package
# splits (run with -run regex), we need multiple gotestsum invocations.
# The Makefile's test-server target only supports a single invocation,
# so this script calls gotestsum directly.
#
# Each invocation produces its own JUnit XML and JSON log files, which
# are merged at the end into the standard report.xml and gotestsum.json
# that the CI pipeline expects.
#
# Input files (in working directory, written by shard-split.js):
#   shard-te-packages.txt   — space-separated TE packages
#   shard-ee-packages.txt   — space-separated EE packages
#   shard-heavy-runs.txt    — one line per heavy run: "pkg REGEX"
#
# Environment variables (set by CI):
#   RACE_MODE          — "-race" on master, empty on PRs
#   ENABLE_COVERAGE    — "true" to enable coverage profiling

GOBIN="$(pwd)/bin"

# Set up build prerequisites (go.work, gotestsum, go versions)
# These are normally done by make test-server-pre.
make setup-go-work gotestsum golang-versions

GOFLAGS_BASE="-buildvcs=false -timeout=90m"
RACE_FLAG="${RACE_MODE:-}"

RUN_IDX=0
FAILURES=0

# run_gotestsum PACKAGES [RUN_REGEX]
#   $1 = space-separated package list
#   $2 = optional -run regex (passed directly to go test)
run_gotestsum() {
  local junitfile="report-${RUN_IDX}.xml"
  local jsonfile="gotestsum-${RUN_IDX}.json"
  local run_flag=""
  if [[ -n "${2:-}" ]]; then run_flag="-run $2"; fi

  local coverage_flag=""
  if [[ "${ENABLE_COVERAGE:-false}" == "true" ]]; then
    coverage_flag="-coverprofile=cover-${RUN_IDX}.out -covermode=atomic"
  fi

  RUN_IDX=$((RUN_IDX + 1))

  GOTESTSUM_JUNITFILE="$junitfile" GOTESTSUM_JSONFILE="$jsonfile" \
    "$GOBIN/gotestsum" --rerun-fails=3 --packages="$1" \
    -- $GOFLAGS_BASE $RACE_FLAG $coverage_flag $run_flag \
    || FAILURES=$((FAILURES + 1))
}

# ── Read shard assignments ──
SHARD_TE=""
SHARD_EE=""
HEAVY_RUNS=""

if [[ -f shard-te-packages.txt ]]; then
  SHARD_TE=$(cat shard-te-packages.txt)
fi
if [[ -f shard-ee-packages.txt ]]; then
  SHARD_EE=$(cat shard-ee-packages.txt)
fi
if [[ -f shard-heavy-runs.txt && -s shard-heavy-runs.txt ]]; then
  HEAVY_RUNS=$(cat shard-heavy-runs.txt)
fi

# ── Run light packages (single invocation, no -run filter) ──
ALL_LIGHT="${SHARD_TE} ${SHARD_EE}"
ALL_LIGHT="${ALL_LIGHT## }"
ALL_LIGHT="${ALL_LIGHT%% }"
if [[ -n "$ALL_LIGHT" ]]; then
  LIGHT_COUNT=$(echo "$ALL_LIGHT" | wc -w)
  echo "Running $LIGHT_COUNT light packages..."
  run_gotestsum "$ALL_LIGHT"
fi

# ── Run heavy package splits (one invocation per package subset) ──
if [[ -n "$HEAVY_RUNS" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    PKG="${line%% *}"
    REGEX="${line#* }"
    SHORT_PKG="${PKG##*/}"
    TEST_COUNT=$(echo "$REGEX" | tr '|' '\n' | wc -l)
    echo "Running $TEST_COUNT tests from $SHORT_PKG..."
    run_gotestsum "$PKG" "$REGEX"
  done <<< "$HEAVY_RUNS"
fi

# ── Merge results from all runs ──
echo "Merging results from $RUN_IDX gotestsum runs..."

if ls report-*.xml 1>/dev/null 2>&1; then
  # Simple XML concatenation — the merge job uses junit-report-merger for proper merging
  head -1 report-0.xml > report.xml
  echo "<testsuites>" >> report.xml
  for f in report-*.xml; do
    grep -v "<?xml" "$f" | grep -v "^<testsuites" | grep -v "^</testsuites" >> report.xml || true
  done
  echo "</testsuites>" >> report.xml
fi

cat gotestsum-*.json > gotestsum.json 2>/dev/null || true

# ── Merge coverage profiles within this shard (if coverage is enabled) ──
# A single shard may run multiple gotestsum invocations (light packages +
# heavy package splits), each producing its own cover-N.out. This merges
# them into one cover.out per shard. The cross-shard merge (combining all
# shards into a single report) is handled by Codecov's after_n_builds.
if [[ "${ENABLE_COVERAGE:-false}" == "true" ]] && ls cover-*.out 1>/dev/null 2>&1; then
  echo "Merging coverage profiles..."
  {
    head -1 cover-0.out  # "mode: atomic" header
    tail -q -n +2 cover-*.out  # data lines from all files
  } > cover.out
  echo "Merged $(ls cover-*.out | wc -l) coverage files into cover.out"
fi

if [[ $FAILURES -gt 0 ]]; then
  echo "Shard complete: $RUN_IDX gotestsum runs, $FAILURES failed"
  exit 1
fi

echo "Shard complete: $RUN_IDX gotestsum runs, all passed"
