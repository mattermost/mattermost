#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

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

export MME2E_TEST_FILTER=${MME2E_TEST_FILTER:-$MME2E_TEST_FILTER_DEFAULT}
${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress node --trace-warnings generate_test_cycle.js ${MME2E_TEST_FILTER}
${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress node run_test_cycle.js \
	2> >(tee ../cypress/logs/cypress.stderr) | tee ../cypress/logs/cypress.stdout
CYPRESS_EXIT_CODE=$?
echo "Cypress exited with code $CYPRESS_EXIT_CODE"

# Collect server logs
${MME2E_DC_SERVER} exec -T -- server cat /mattermost/logs/mattermost.log >../cypress/logs/mattermost.log
