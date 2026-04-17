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

mme2e_log "Start LibreTranslate mock server for autotranslation tests"
${MME2E_DC_SERVER} exec -u "$MME2E_UID" -d -- playwright bash -c "cd e2e-tests/playwright && npm run start:libretranslate-mock" || true

mme2e_log "Wait for LibreTranslate mock server to be ready"
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash -c "for i in {1..30}; do curl -s http://localhost:3010/ && exit 0; sleep 1; done; echo 'Mock server failed to start'; exit 1" || true

# Run Playwright tests in TWO sharded passes on the same runner:
#   pass 1: --project=chrome        — parallel config-safe suite
#   pass 2: --project=chrome-serial — specs that mutate global server config
#
# We run them sequentially (not via a Playwright project dependency) because
# when `chrome-serial` depends on `chrome`, Playwright does NOT shard the
# dependency project — every shard re-runs the full `chrome` suite as setup,
# duplicating ~94% of work across shards. See PR #36054 investigation.
#
# Both passes share the same PW_SHARD value so shard N runs 1/8 of chrome
# plus 1/8 of chrome-serial. Blob reports from the first pass are prefixed
# so the second pass's blob file doesn't overwrite it; `merge-reports` in
# the CI template picks up both.
#
# NB: do not exit the script if some testcases fail — we want both passes
# to attempt to run even if the first has failures, so we get full signal.
#
# Pass TEST_FILTER and PW_SHARD with `docker compose exec -e VAR` (no =value)
# so Compose copies them from this shell's environment. Do NOT use
# -e "VAR=${VAR}": TEST_FILTER is e.g. --grep-invert "@visual" and embedded
# quotes break the host command line, which previously caused PW_SHARD to be
# lost and every shard to run the full suite.

mme2e_log "Playwright pass 1/2: chrome (parallel)"
${MME2E_DC_SERVER} exec -i -T -u "$MME2E_UID" \
  -e TEST_FILTER \
  -e PW_SHARD \
  -- playwright bash -lc "cd e2e-tests/playwright && npm run test:ci -- \${TEST_FILTER:+\$TEST_FILTER} \${PW_SHARD:+\$PW_SHARD}" | tee ../playwright/logs/playwright-chrome.log || true

# Preserve the chrome pass's blob reports so pass 2 doesn't overwrite them.
# Playwright's blob reporter names sharded outputs `report-<index>.zip`,
# which collides across two passes with the same PW_SHARD.
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash -lc "
  cd e2e-tests/playwright/results/blob-report 2>/dev/null || exit 0
  for f in *.zip; do
    [ -e \"\$f\" ] || continue
    mv \"\$f\" \"chrome-\$f\"
  done
" || true

mme2e_log "Playwright pass 2/2: chrome-serial (serialized config-mutating specs)"
${MME2E_DC_SERVER} exec -i -T -u "$MME2E_UID" \
  -e TEST_FILTER \
  -e PW_SHARD \
  -- playwright bash -lc "cd e2e-tests/playwright && npm run test:ci-serial -- \${TEST_FILTER:+\$TEST_FILTER} \${PW_SHARD:+\$PW_SHARD}" | tee ../playwright/logs/playwright-serial.log || true

# Keep a combined tail log for backwards-compat with anything grepping
# playwright.log. The authoritative results are the blob reports merged
# by the CI template's calculate-results job.
cat ../playwright/logs/playwright-chrome.log ../playwright/logs/playwright-serial.log >../playwright/logs/playwright.log 2>/dev/null || true

# Collect run results from the SECOND pass's results.json. This summary
# is used only by local dev / the cypress-oriented template; the playwright
# CI template computes authoritative totals from the merged blob reports.
# Documentation on the results.json file: https://playwright.dev/docs/api/class-testcase#test-case-expected-status
jq -f /dev/stdin ../playwright/results/reporter/results.json >../playwright/results/summary.json <<EOF
{
  passed: .stats.expected,
  failed: .stats.unexpected,
  failed_expected: (.stats.skipped + .stats.flaky)
}
EOF

# Collect server logs
${MME2E_DC_SERVER} logs --no-log-prefix -- server >../playwright/logs/mattermost.log 2>&1
