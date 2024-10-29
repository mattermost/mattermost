#!/bin/bash
# shellcheck disable=SC2038
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

# Print run information
mme2e_log "Printing Cypress container informations"
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress node -p 'module.paths'
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress bash <<"EOF"
cat <<INNEREOF
node version:    $(node -v)
npm version:     $(npm -v)
debian version:  $(cat /etc/debian_version)
user:            $(whoami)
chrome:          $(google-chrome --version || true)
firefox:         $(firefox --version || true)
INNEREOF
EOF

# Initialize cypress report directory
mme2e_log "Prepare Cypress: clean and initialize report and logs directory"
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress bash <<EOF
rm -rf logs results
mkdir -p logs
mkdir -p results/junit
touch results/junit/empty.xml
echo '<?xml version="1.0" encoding="UTF-8"?>' > results/junit/empty.xml
EOF

# Run cypress test
# No need to collect its exit status: if it's nonzero, this script will terminate since we use '-e'
LOGFILE_SUFFIX="${CI_BASE_URL//\//_}" # Remove slashes from CI_BASE_URL to produce a usable filename
# shellcheck disable=SC2016
if ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress bash -c '[ -n "${AUTOMATION_DASHBOARD_URL}" ]'; then
  mme2e_log "AUTOMATION_DASHBOARD_URL is set. Using run_test_cycle.js for the cypress run"
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress node run_test_cycle.js | tee "../cypress/logs/${LOGFILE_SUFFIX}_cypress.log"
else
  mme2e_log "AUTOMATION_DASHBOARD_URL is unset. Using run_tests.js for the cypress run"
  # shellcheck disable=SC2086
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress node run_tests.js $TEST_FILTER | tee "../cypress/logs/${LOGFILE_SUFFIX}_cypress.log"
fi

# Collect run results
cat > ../cypress/results/summary.json <<EOF
{
  "passed": $(find ../cypress/results/mochawesome-report/json/tests/ -name '*.json' | xargs -l jq -r '.stats.passes' | jq -s add),
  "failed": $(find ../cypress/results/mochawesome-report/json/tests/ -name '*.json' | xargs -l jq -r '.stats.failures' | jq -s add),
  "failed_expected": 0
}
EOF

# Collect server logs
${MME2E_DC_SERVER} logs --no-log-prefix -- server > "../cypress/logs/${LOGFILE_SUFFIX}_mattermost.log" 2>&1
