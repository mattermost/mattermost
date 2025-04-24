#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

mme2e_log "Prepare Playwright: clean and initialize report and logs directory"
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash <<EOF
cd e2e-tests/playwright
rm -rf logs results storage_state
mkdir -p logs results
touch logs/mattermost.log
EOF

mme2e_log "Prepare Playwright: install dependencies"
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash <<EOF
cd webapp/
npm install --cache /tmp/empty-cache
cd ../e2e-tests/playwright
npm install --cache /tmp/empty-cache
EOF

mme2e_log "Prepare Playwright: environment info"
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash <<"EOF"
cat <<INNEREOF
debian      = $(cat /etc/debian_version)
uname       = $(uname -m)
node        = $(node -v)
npm         = $(npm -v)
playwright  = $(cd e2e-tests/playwright && npx playwright --version)
browsers
$(du -hs ~/ms-playwright/* | awk '{print "            = " $2 " (" $1 ")"}')
INNEREOF
EOF

# Enable next line to debug Playwright
# export DEBUG=pw:protocol,pw:browser,pw:api

# Run Playwright test
# NB: do not exit the script if some testcases fail
${MME2E_DC_SERVER} exec -i -u "$MME2E_UID" -- playwright bash -c "cd e2e-tests/playwright && npm run test:ci -- ${TEST_FILTER}" | tee ../playwright/logs/playwright.log || true

# Collect run results
# Documentation on the results.json file: https://playwright.dev/docs/api/class-testcase#test-case-expected-status

jq -f /dev/stdin ../playwright/results/reporter/results.json > ../playwright/results/summary.json <<EOF
{
  passed: .stats.expected,
  failed: .stats.unexpected,
  failed_expected: (.stats.skipped + .stats.flaky)
}
EOF

# Collect server logs
${MME2E_DC_SERVER} logs --no-log-prefix -- server >../playwright/logs/mattermost.log 2>&1
