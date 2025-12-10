#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

# Configuration
ADMIN_USERNAME="${MM_ADMIN_USERNAME:-sysadmin}"
ADMIN_PASSWORD="${MM_ADMIN_PASSWORD:-Sys@dmin-sample1}"
ADMIN_EMAIL="${MM_ADMIN_EMAIL:-sysadmin@sample.mattermost.com}"
LIGHTHOUSE_RUNS="${LIGHTHOUSE_RUNS:-5}"
LIGHTHOUSE_PAGES="${LIGHTHOUSE_PAGES:---all}"
LIGHTHOUSE_BASELINE_SUFFIX="${LIGHTHOUSE_BASELINE_SUFFIX:-}"

mme2e_log "=== Web Vitals with Lighthouse ==="

# Step 1: Create admin user (first user becomes system admin)
mme2e_log "Creating admin user via mmctl..."
${MME2E_DC_SERVER} exec -T -- server mmctl --local user create \
  --username "$ADMIN_USERNAME" \
  --email "$ADMIN_EMAIL" \
  --password "$ADMIN_PASSWORD" \
  --system-admin \
  --email-verified || {
    mme2e_log "User may already exist, attempting to continue..."
  }

# Step 2: Create default team
mme2e_log "Creating default team via mmctl..."
${MME2E_DC_SERVER} exec -T -- server mmctl --local team create \
  --name "ad-1" \
  --display-name "ad-1" || {
    mme2e_log "Team may already exist, attempting to continue..."
  }

# Add admin user to the team
mme2e_log "Adding admin to team..."
${MME2E_DC_SERVER} exec -T -- server mmctl --local team users add ad-1 "$ADMIN_USERNAME" || {
    mme2e_log "User may already be in team, attempting to continue..."
  }

# Step 3: Enable required settings for testing
mme2e_log "Configuring server settings..."
for SETTING in \
  TeamSettings.EnableOpenServer=true \
  ServiceSettings.EnableInsecureOutgoingConnections=true; do
  mme2e_log "Setting: $SETTING"
  # shellcheck disable=SC2046
  ${MME2E_DC_SERVER} exec -T -- server mmctl --local config set $(tr '=' ' ' <<<"$SETTING") || true
done

# Step 4: Upload license if provided
if [ -n "${MM_LICENSE:-}" ]; then
  mme2e_log "Uploading license to server..."
  ${MME2E_DC_SERVER} exec -T -- server mmctl --local license upload-string "$MM_LICENSE"
fi

# Step 5: Install Lighthouse dependencies
mme2e_log "Installing Lighthouse dependencies..."
cd ../lighthouse

# Ensure results directory exists
mkdir -p results

npm ci

# Step 6: Run Lighthouse tests
mme2e_log "Running Web Vitals with Lighthouse tests..."
mme2e_log "  Pages: $LIGHTHOUSE_PAGES"
mme2e_log "  Runs per page: $LIGHTHOUSE_RUNS"

# Export environment variables for lighthouse
export MM_BASE_URL="http://localhost:8065"
export MM_ADMIN_USERNAME="$ADMIN_USERNAME"
export MM_ADMIN_PASSWORD="$ADMIN_PASSWORD"
export NODE_OPTIONS="--max-old-space-size=8192"

# Build lighthouse command with optional baseline suffix
LIGHTHOUSE_CMD="npm run lh -- $LIGHTHOUSE_PAGES --runs=$LIGHTHOUSE_RUNS"
if [ -n "$LIGHTHOUSE_BASELINE_SUFFIX" ]; then
    LIGHTHOUSE_CMD="$LIGHTHOUSE_CMD --baseline-suffix=$LIGHTHOUSE_BASELINE_SUFFIX"
    mme2e_log "  Baseline suffix: $LIGHTHOUSE_BASELINE_SUFFIX"
fi

# Run lighthouse tests
# Exit code: 0 = PASS/WARN, 1 = FAIL (any page failed Web Vitals thresholds)
$LIGHTHOUSE_CMD 2>&1 | tee results/lighthouse.log
LIGHTHOUSE_EXIT_CODE=${PIPESTATUS[0]}

if [ "$LIGHTHOUSE_EXIT_CODE" -ne 0 ]; then
  mme2e_log "Lighthouse tests FAILED - one or more pages exceeded Web Vitals thresholds"
fi

# Step 7: Collect server logs
mme2e_log "Collecting server logs..."
cd ../.ci
${MME2E_DC_SERVER} logs --no-log-prefix -- server >../lighthouse/results/mattermost.log 2>&1 || true

mme2e_log "=== Lighthouse testing complete ==="
mme2e_log "Results in e2e-tests/lighthouse/results/"

# Exit with Lighthouse result code (0 = PASS/WARN, 1 = FAIL)
exit "$LIGHTHOUSE_EXIT_CODE"
