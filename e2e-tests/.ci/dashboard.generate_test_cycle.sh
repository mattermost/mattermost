#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

TEST_ENV_FILE=".env.$TEST"

mme2e_log "Loading variables from $TEST_ENV_FILE"
if ! [ -f "$TEST_ENV_FILE" ]; then
  mme2e_log "Error: $TEST_ENV_FILE is required to exist, for the test cycle to be generated. Aborting." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$TEST_ENV_FILE"

if [ -z "${AUTOMATION_DASHBOARD_URL:-}" ]; then
  mme2e_log "AUTOMATION_DASHBOARD_URL is unset. Skipping test cycle generation."
  exit 0
fi

mme2e_log "Generating the test cycle on the Automation Dashboard"
cd "../$TEST"
npm i
# shellcheck disable=SC2086
exec node --trace-warnings generate_test_cycle.js $TEST_FILTER
