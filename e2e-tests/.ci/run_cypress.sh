#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

# TODO interact with the 'cycles' API
# TODO retrieve the logs after the test run

# Create output directories
mkdir -p ../cypress/{results,logs}

# Create dummy file to prevent error uploading the test results
mkdir -p ../cypress/results/junit
touch ../cypress/results/junit/dummy.xml

${MME2E_DOCKER_COMPOSE} exec -T -u $UID cypress npm ci
${MME2E_DOCKER_COMPOSE} exec -T -u $UID cypress node -p 'module.paths'
${MME2E_DOCKER_COMPOSE} exec -T -u $UID cypress bash <<"EOF"
cat <<INNEREOF
node version:    $(node -v)
npm version:     $(npm -v)
debian version:  $(cat /etc/debian_version)
user:            $(whoami)
chrome:          $(google-chrome --version || true)
firefox:         $(firefox --version || true)
INNEREOF
EOF
# TODO change this to run run_test_cycle.js instead, after testing
${MME2E_DOCKER_COMPOSE} exec -T -u 1000 cypress ./node_modules/.bin/cypress run --spec tests/integration/channels/accessibility/accessibility_dropdowns_spec.js \
	2> >(tee ../cypress/logs/cypress.stderr) | tee ../cypress/logs/cypress.stdout
CYPRESS_EXIT_CODE=$?
echo "Cypress exited with code $CYPRESS_EXIT_CODE"
