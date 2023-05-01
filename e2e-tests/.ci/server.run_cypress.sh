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

#${MME2E_DOCKER_COMPOSE} exec -T -u $MME2E_UID cypress npm ci #TODO use this instead of the line below
${MME2E_DOCKER_COMPOSE} exec -T -u $MME2E_UID cypress npm i
${MME2E_DOCKER_COMPOSE} exec -T -u $MME2E_UID cypress node -p 'module.paths'
${MME2E_DOCKER_COMPOSE} exec -T -u $MME2E_UID cypress bash <<"EOF"
cat <<INNEREOF
node version:    $(node -v)
npm version:     $(npm -v)
debian version:  $(cat /etc/debian_version)
user:            $(whoami)
chrome:          $(google-chrome --version || true)
firefox:         $(firefox --version || true)
INNEREOF
EOF
${MME2E_DOCKER_COMPOSE} exec -T -u $MME2E_UID cypress node run_test_cycle.js \
	2> >(tee ../cypress/logs/cypress.stderr) | tee ../cypress/logs/cypress.stdout
#${MME2E_DOCKER_COMPOSE} exec -T -u $MME2E_UID cypress ./node_modules/.bin/cypress run --spec tests/integration/channels/accessibility/accessibility_dropdowns_spec.js \
#	2> >(tee ../cypress/logs/cypress.stderr) | tee ../cypress/logs/cypress.stdout
CYPRESS_EXIT_CODE=$?
echo "Cypress exited with code $CYPRESS_EXIT_CODE"
