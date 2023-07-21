#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

# Set required variables
TEST_FILTER_DEFAULT='--stage=@prod --group=@smoke'
TEST_FILTER=${TEST_FILTER:-$TEST_FILTER_DEFAULT}

# Print run information
mme2e_log "Printing Cypress container informations"
${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress node -p 'module.paths'
${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress bash <<"EOF"
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
${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress bash <<EOF
rm -rf logs results
mkdir -p logs
mkdir -p results/junit
touch results/junit/empty.xml
echo '<?xml version="1.0" encoding="UTF-8"?>' > results/junit/empty.xml
EOF

# Run cypress test
# No need to collect its exit status: if it's nonzero, this script will terminate since we use '-e'
if ${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress bash -c '[ -n "${AUTOMATION_DASHBOARD_URL}" ]'; then
	mme2e_log "AUTOMATION_DASHBOARD_URL is set. Using run_test_cycle.js for the cypress run"
	${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress node --trace-warnings generate_test_cycle.js ${TEST_FILTER}
	${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress node run_test_cycle.js | tee ../cypress/logs/cypress.log
else
	mme2e_log "AUTOMATION_DASHBOARD_URL is unset. Using run_tests.js for the cypress run"
	${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress node run_tests.js ${TEST_FILTER} | tee ../cypress/logs/cypress.log
fi

# Collect server logs
${MME2E_DC_SERVER} logs --no-log-prefix -- server > ../cypress/logs/mattermost.log 2>&1
