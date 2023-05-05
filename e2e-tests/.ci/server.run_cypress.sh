#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

# Set required variables
MME2E_TEST_FILTER_DEFAULT='--group=@smoke'
MME2E_TEST_FILTER=${MME2E_TEST_FILTER:-$MME2E_TEST_FILTER_DEFAULT}

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

# Run cypress test
if ${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress bash -c '[ -n "${AUTOMATION_DASHBOARD_URL}" ]'; then
	mme2e_log "AUTOMATION_DASHBOARD_URL is set. Using run_test_cycle.js for the cypress run"
	${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress node --trace-warnings generate_test_cycle.js ${MME2E_TEST_FILTER}
	${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress node run_test_cycle.js \
		2> >(tee ../cypress/logs/cypress.stderr) | tee ../cypress/logs/cypress.stdout
else
	mme2e_log "AUTOMATION_DASHBOARD_URL is unset. Using run_tests.js for the cypress run"
	${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress node run_tests.js ${MME2E_TEST_FILTER} \
		2> >(tee ../cypress/logs/cypress.stderr) | tee ../cypress/logs/cypress.stdout
fi
CYPRESS_EXIT_CODE=$?
mme2e_log "Cypress exited with code: $CYPRESS_EXIT_CODE"

# Collect server logs
${MME2E_DC_SERVER} exec -T -- server cat /mattermost/logs/mattermost.log >../cypress/logs/mattermost.log
