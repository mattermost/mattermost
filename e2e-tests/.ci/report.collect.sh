#!/bin/bash
# SC2034: <variable> appears unused.
# https://www.shellcheck.net/wiki/SC2034
# shellcheck disable=SC2034
# shellcheck disable=SC2086,SC2223

set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

# The collected data will be written to the "e2e-tests/$TEST/results/" directory
cd "../$TEST/"
if [ ! -d "results/" ]; then
  mme2e_log "Error: 'results/' directory does not exist. Aborting report data collection." >&2
  exit 1
fi

# If the Automation Dashboard is used, try to collect run data from it
if [ -n "${AUTOMATION_DASHBOARD_URL:-}" ]; then
  mme2e_log "Automation Dashboard usage detected: retrieving cycle results"
  # Assume that we're in the cypress dir and that the 'results/' directory exists
  : ${BUILD_ID:?}
  AD_CYCLE_FILE="results/ad_cycle.json"
  AD_SPECS_FILE="results/ad_specs.json"
  curl -o "$AD_CYCLE_FILE" -fsSL "${AUTOMATION_DASHBOARD_URL}/cycle?build=${BUILD_ID}"
  curl -o "$AD_SPECS_FILE" -fsSL "${AUTOMATION_DASHBOARD_URL}/executions/specs?cycle_id=$(jq -r .id "$AD_CYCLE_FILE")"
fi
