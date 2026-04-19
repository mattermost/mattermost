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

# Compute the balanced spec list for this shard using the duration-based
# shard balancer. On the first run (no `.test-durations.json` cached yet)
# the balancer prints nothing and we fall back to Playwright's built-in
# `--shard=N/M` contiguous split (via PW_SHARD).
#
# When the balancer produces a list, we pass those spec files as positional
# args and DO NOT pass `--shard` — otherwise Playwright would further
# subdivide our already-balanced slice.
BALANCED_SPECS=""
if [ -n "${PW_SHARD_INDEX:-}" ] && [ -n "${PW_SHARD_TOTAL:-}" ]; then
  BALANCED_SPECS=$(${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash -lc \
    "cd e2e-tests/playwright && node scripts/shard-balancer.mjs ${PW_SHARD_INDEX} ${PW_SHARD_TOTAL}" 2>/dev/null || true)
  BALANCED_SPECS=$(echo "$BALANCED_SPECS" | tr -d '\r' | xargs || true)
  if [ -n "$BALANCED_SPECS" ]; then
    FILE_COUNT=$(echo "$BALANCED_SPECS" | wc -w | tr -d ' ')
    mme2e_log "Shard ${PW_SHARD_INDEX}/${PW_SHARD_TOTAL} (balanced): ${FILE_COUNT} spec files"
  else
    mme2e_log "Shard balancer produced no list; falling back to --shard=${PW_SHARD_INDEX}/${PW_SHARD_TOTAL}"
  fi
fi

# Run the Playwright functional suite as a single sharded pass under the
# `chrome` project. Any config-mutating specs must isolate their own setup
# (unique team/channel/user, afterAll cleanup); the old chrome-serial
# escape hatch was removed because Playwright's project-dependency
# implementation re-ran the full chrome suite on every shard.
#
# NB: do not exit on test failures — we need the retry step below to run.
#
# Pass TEST_FILTER, PW_SHARD and BALANCED_SPECS with `docker compose exec
# -e VAR` (no =value) so Compose copies them from this shell's environment.
# Do NOT use -e "VAR=${VAR}": TEST_FILTER is e.g. --grep-invert "@visual"
# and embedded quotes break the host command line, which previously caused
# PW_SHARD to be lost and every shard to run the full suite.

mme2e_log "Playwright: running chrome project (sharded)"
if [ -n "$BALANCED_SPECS" ]; then
  ${MME2E_DC_SERVER} exec -i -T -u "$MME2E_UID" \
    -e TEST_FILTER \
    -e BALANCED_SPECS \
    -- playwright bash -lc "cd e2e-tests/playwright && npm run test:ci -- \$BALANCED_SPECS \${TEST_FILTER:+\$TEST_FILTER}" | tee ../playwright/logs/playwright-first.log || true
else
  ${MME2E_DC_SERVER} exec -i -T -u "$MME2E_UID" \
    -e TEST_FILTER \
    -e PW_SHARD \
    -- playwright bash -lc "cd e2e-tests/playwright && npm run test:ci -- \${TEST_FILTER:+\$TEST_FILTER} \${PW_SHARD:+\$PW_SHARD}" | tee ../playwright/logs/playwright-first.log || true
fi

# ──────────────────────────────────────────────────────────────────────
# Inline per-shard retry
# ──────────────────────────────────────────────────────────────────────
# If any specs failed, re-run JUST those specs on the SAME server (no new
# provisioning). This replaces the standalone `run-failed-tests` CI job,
# which spent ~4-7 min spinning up a fresh server per run.
#
# IMPORTANT: Playwright's blob reporter WIPES its outputDir at the start
# of every invocation. If we leave first-pass blobs inside
# `results/blob-report/`, a follow-on `npm run test:ci` deletes them.
# So we move first-pass blobs OUT of that directory (into a stash on
# the mounted volume, outside `results/`), and move them back right
# before merge-reports. Retry blobs are prefixed with `retry-` to avoid
# a filename collision with first-pass blobs when both come back.
STASH_DIR="e2e-tests/playwright/.blob-stash"

${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash -lc "
  rm -rf ${STASH_DIR}
  mkdir -p ${STASH_DIR}
  if compgen -G 'e2e-tests/playwright/results/blob-report/*.zip' >/dev/null 2>&1; then
    for f in e2e-tests/playwright/results/blob-report/*.zip; do
      mv \"\$f\" \"${STASH_DIR}/first-\$(basename \"\$f\")\"
    done
  fi
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

  # If we used the balancer for the first pass, we pass the failed specs
  # as positional args without --shard (the specs are already scoped to
  # this shard). Otherwise we preserve the previous behavior and pass
  # --shard through so Playwright applies its alphabetical slice.
  if [ -n "$BALANCED_SPECS" ]; then
    ${MME2E_DC_SERVER} exec -i -T -u "$MME2E_UID" \
      -e TEST_FILTER \
      -- playwright bash -lc "cd e2e-tests/playwright && npm run test:ci -- $SPEC_ARGS \${TEST_FILTER:+\$TEST_FILTER}" | tee ../playwright/logs/playwright-retry.log || true
  else
    ${MME2E_DC_SERVER} exec -i -T -u "$MME2E_UID" \
      -e TEST_FILTER \
      -e PW_SHARD \
      -- playwright bash -lc "cd e2e-tests/playwright && npm run test:ci -- $SPEC_ARGS \${TEST_FILTER:+\$TEST_FILTER} \${PW_SHARD:+\$PW_SHARD}" | tee ../playwright/logs/playwright-retry.log || true
  fi

  # Stash retry blobs alongside the first-pass blobs.
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash -lc "
    if compgen -G 'e2e-tests/playwright/results/blob-report/*.zip' >/dev/null 2>&1; then
      for f in e2e-tests/playwright/results/blob-report/*.zip; do
        mv \"\$f\" \"${STASH_DIR}/retry-\$(basename \"\$f\")\"
      done
    fi
  " || true
fi

# Move all stashed blobs back into blob-report/ for final merge-reports
# and for upload-artifact. This step runs whether or not retries ran:
# if no retries, we just put the first-pass blobs back.
${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- playwright bash -lc "
  mkdir -p e2e-tests/playwright/results/blob-report
  if compgen -G '${STASH_DIR}/*.zip' >/dev/null 2>&1; then
    mv ${STASH_DIR}/*.zip e2e-tests/playwright/results/blob-report/
  fi
  rmdir ${STASH_DIR} 2>/dev/null || true
" || true

# Merge the combined blob set into a single results.json so the per-shard
# `summary.json` below reflects first-pass + retry outcomes. The cross-
# shard merge in the CI template's `calculate-results` job will re-merge
# all shards' blobs from the same `blob-report/` contents.
if [ -n "$FAILED_SPECS" ]; then
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
