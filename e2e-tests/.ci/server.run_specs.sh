#!/bin/bash
# shellcheck disable=SC2038
# Run specific spec files
# Usage: SPEC_FILES="path/to/spec1.ts,path/to/spec2.ts" make start-server run-specs

set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

if [ -z "${SPEC_FILES:-}" ]; then
  mme2e_log "Error: SPEC_FILES environment variable is required"
  mme2e_log "Usage: SPEC_FILES=\"path/to/spec.ts\" make start-server run-specs"
  exit 1
fi

mme2e_log "Running spec files: $SPEC_FILES"

case $TEST in
cypress)
  mme2e_log "Running Cypress with specified specs"
  # Initialize cypress report directory
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress bash <<EOF
rm -rf logs results
mkdir -p logs
mkdir -p results/junit
mkdir -p results/mochawesome-report/json/tests
touch results/junit/empty.xml
echo '<?xml version="1.0" encoding="UTF-8"?>' > results/junit/empty.xml
EOF

  # Run cypress with specific spec files and mochawesome reporter
  LOGFILE_SUFFIX="${CI_BASE_URL//\//_}_specs"
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress npx cypress run \
    --spec "$SPEC_FILES" \
    --reporter cypress-multi-reporters \
    --reporter-options configFile=reporter-config.json \
    | tee "../cypress/logs/${LOGFILE_SUFFIX}_cypress.log" || true

  # Collect run results
  if [ -d ../cypress/results/mochawesome-report/json/tests/ ]; then
    cat >../cypress/results/summary.json <<EOF
{
  "passed": $(find ../cypress/results/mochawesome-report/json/tests/ -name '*.json' | xargs -l jq -r '.stats.passes' | jq -s add),
  "failed": $(find ../cypress/results/mochawesome-report/json/tests/ -name '*.json' | xargs -l jq -r '.stats.failures' | jq -s add),
  "failed_expected": 0
}
EOF
  fi

  # Collect server logs
  ${MME2E_DC_SERVER} logs --no-log-prefix -- server >"../cypress/logs/${LOGFILE_SUFFIX}_mattermost.log" 2>&1
  ;;
playwright)
  mme2e_log "Running Playwright with specified specs"
  # Convert comma-separated to space-separated for playwright
  SPEC_ARGS=$(echo "$SPEC_FILES" | tr ',' ' ')

  # Initialize playwright report and logs directory
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash <<EOF
cd e2e-tests/playwright
rm -rf logs results storage_state
mkdir -p logs results
touch logs/mattermost.log
EOF

  # Install dependencies
  mme2e_log "Prepare Playwright: install dependencies"
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash <<EOF
cd webapp/
npm install --cache /tmp/empty-cache
cd ../e2e-tests/playwright
npm install --cache /tmp/empty-cache
EOF

  # Run playwright with specific spec files
  LOGFILE_SUFFIX="${CI_BASE_URL//\//_}_specs"
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash -c "cd e2e-tests/playwright && npm run test:ci -- $SPEC_ARGS" | tee "../playwright/logs/${LOGFILE_SUFFIX}_playwright.log" || true

  # Collect run results (if results.json exists)
  if [ -f ../playwright/results/reporter/results.json ]; then
    jq -f /dev/stdin ../playwright/results/reporter/results.json >../playwright/results/summary.json <<EOF
{
  passed: .stats.expected,
  failed: .stats.unexpected,
  failed_expected: (.stats.skipped + .stats.flaky)
}
EOF
    mme2e_log "Results file found and summary generated"
  fi

  # Collect server logs
  ${MME2E_DC_SERVER} logs --no-log-prefix -- server >"../playwright/logs/${LOGFILE_SUFFIX}_mattermost.log" 2>&1
  ;;
*)
  mme2e_log "Error, unsupported value for TEST: $TEST" >&2
  mme2e_log "Aborting" >&2
  exit 1
  ;;
esac

mme2e_log "Spec run complete"
