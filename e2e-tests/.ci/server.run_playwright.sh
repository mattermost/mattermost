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

# Run the Playwright functional suite as a single sharded pass under the
# `chrome` project. Any config-mutating specs must isolate their own setup
# (unique team/channel/user, afterAll cleanup); the old chrome-serial
# escape hatch was removed because Playwright's project-dependency
# implementation re-ran the full chrome suite on every shard.
#
# NB: do not exit on test failures — we need the retry step below to run.
#
# Pass TEST_FILTER and PW_SHARD with `docker compose exec -e VAR` (no =value)
# so Compose copies them from this shell's environment. Do NOT use
# -e "VAR=${VAR}": TEST_FILTER is e.g. --grep-invert "@visual" and embedded
# quotes break the host command line, which previously caused PW_SHARD to be
# lost and every shard to run the full suite.

mme2e_log "Playwright: running chrome project (sharded)"
${MME2E_DC_SERVER} exec -i -T -u "$MME2E_UID" \
  -e TEST_FILTER \
  -e PW_SHARD \
  -- playwright bash -lc "cd e2e-tests/playwright && npm run test:ci -- \${TEST_FILTER:+\$TEST_FILTER} \${PW_SHARD:+\$PW_SHARD}" | tee ../playwright/logs/playwright-first.log || true

# ──────────────────────────────────────────────────────────────────────
# Inline per-shard retry
# ──────────────────────────────────────────────────────────────────────
# If any specs failed, re-run JUST those specs on the SAME server (no new
# provisioning). This replaces the standalone `run-failed-tests` CI job,
# which spent ~4-7 min spinning up a fresh server per run.
#
# Pass-1 blobs are renamed to `first-*.zip` so the retry pass doesn't
# overwrite them (Playwright's blob reporter names sharded outputs
# `report-<index>.zip`). merge-reports at the end combines both sets so
# tests that pass on retry appear as `flaky`, not `failed`.
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash -lc "
  cd e2e-tests/playwright/results/blob-report 2>/dev/null || exit 0
  for f in report-*.zip; do
    [ -e \"\$f\" ] || continue
    mv \"\$f\" \"first-\$f\"
  done
" || true

RESULTS_FILE="../playwright/results/reporter/results.json"
FAILED_SPECS=""
if [ -f "$RESULTS_FILE" ]; then
  FAILED_SPECS=$(jq -r '
    [.suites[] | . as $top |
      (recurse(.suites[]?) | .specs[]? | .tests[]? |
       select((.results | length) > 0) |
       select((.results | last).status == "failed" or (.results | last).status == "timedOut") |
       (.location.file // $top.file))
    ] | map(select(. != null)) | unique | join(",")
  ' "$RESULTS_FILE" 2>/dev/null || echo "")
fi

if [ -n "$FAILED_SPECS" ]; then
  mme2e_log "Retrying failed specs on the same runner: $FAILED_SPECS"
  SPEC_ARGS=$(echo "$FAILED_SPECS" | tr ',' ' ')

  ${MME2E_DC_SERVER} exec -i -T -u "$MME2E_UID" \
    -e TEST_FILTER \
    -e PW_SHARD \
    -- playwright bash -lc "cd e2e-tests/playwright && npm run test:ci -- $SPEC_ARGS \${TEST_FILTER:+\$TEST_FILTER} \${PW_SHARD:+\$PW_SHARD}" | tee ../playwright/logs/playwright-retry.log || true

  # Rename retry blobs so the merge step sees both first-* and retry-*.
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash -lc "
    cd e2e-tests/playwright/results/blob-report 2>/dev/null || exit 0
    for f in report-*.zip; do
      [ -e \"\$f\" ] || continue
      mv \"\$f\" \"retry-\$f\"
    done
  " || true

  # Re-merge first-* + retry-* into a single results.json. Tests that
  # failed in the first pass but passed on retry appear as `flaky`.
  mme2e_log "Merging first-pass + retry blob reports"
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash -lc "
    cd e2e-tests/playwright
    rm -rf results/reporter
    mkdir -p results/reporter
    npx playwright merge-reports --config merge.config.mjs results/blob-report
  " || true
else
  mme2e_log "No failed specs in shard; skipping inline retry"
fi

# Keep a combined tail log for backwards-compat with anything grepping
# playwright.log. The authoritative results are the merged blob reports.
cat ../playwright/logs/playwright-first.log \
    ../playwright/logs/playwright-retry.log \
    >../playwright/logs/playwright.log 2>/dev/null || true

# Collect run results from the merged results.json. This summary is used
# only by local dev / the cypress-oriented template; the playwright CI
# template computes authoritative totals from the merged blob reports it
# downloads across all shards.
# Documentation: https://playwright.dev/docs/api/class-testcase#test-case-expected-status
if [ -f ../playwright/results/reporter/results.json ]; then
  jq -f /dev/stdin ../playwright/results/reporter/results.json >../playwright/results/summary.json <<EOF
{
  passed: .stats.expected,
  failed: .stats.unexpected,
  failed_expected: (.stats.skipped + .stats.flaky)
}
EOF
fi

# Collect server logs
${MME2E_DC_SERVER} logs --no-log-prefix -- server >../playwright/logs/mattermost.log 2>&1
