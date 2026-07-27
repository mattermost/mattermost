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

mme2e_log "Prepare Cypress: ensure container user entry exists for UID $MME2E_UID"
${MME2E_DC_SERVER} exec -T -- cypress bash <<EOF
getent passwd $MME2E_UID >/dev/null 2>&1 || \
  useradd --uid $MME2E_UID --gid 0 --home /root --no-create-home --shell /bin/bash mme2euser 2>/dev/null || true
EOF

mme2e_log "Prepare Cypress: install dependencies"
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress bash <<EOF
npm install --cache /tmp/empty-cache
EOF
# cypress install verifies the Electron binary, which needs a display and dbus session.
# Use xvfb-run and dbus-run-session for the headless virtual display and bus.
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress bash <<'EOF'
set -euo pipefail
Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp &
XVFB_PID=$!
trap 'kill "$XVFB_PID" 2>/dev/null || true' EXIT
sleep 1
DISPLAY=:99 dbus-run-session -- cypress install
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
cat >../cypress/results/summary.json <<EOF
{
  "passed": $(find ../cypress/results/mochawesome-report/json/tests/ -name '*.json' | xargs -l jq -r '.stats.passes' | jq -s add),
  "failed": $(find ../cypress/results/mochawesome-report/json/tests/ -name '*.json' | xargs -l jq -r '.stats.failures' | jq -s add),
  "failed_expected": 0
}
EOF

# Collect server logs
${MME2E_DC_SERVER} logs --no-log-prefix -- server >"../cypress/logs/${LOGFILE_SUFFIX}_mattermost.log" 2>&1
