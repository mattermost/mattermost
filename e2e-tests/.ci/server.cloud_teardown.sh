#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc
[ -f .env.cloud ] && . .env.cloud

if [ -z "${MM_CUSTOMER_ID:-}" ]; then
  mme2e_log "Skipping cloud instance teardown: MM_CUSTOMER_ID variable is empty, no cloud user to cleanup."
  exit 0
fi

mme2e_log "Tearing down cloud tests"

mme2e_log "Loading .env.cloud"
. .env.cloud

# Assert that required variables are set
MME2E_ENVCHECK_MSG="variable required for tearing down cloud tests, but is empty or unset."
: "${CWS_URL:?$MME2E_ENVCHECK_MSG}"
: "${MM_CUSTOMER_ID:?$MME2E_ENVCHECK_MSG}"

mme2e_log "Deleting customer $MM_CUSTOMER_ID."
curl -fsSL -X DELETE -H @- "${CWS_URL}/api/v1/tests/customers/$MM_CUSTOMER_ID/payment-customer" <<<"${CWS_EXTRA_HTTP_HEADERS:-}"
rm -fv .env.cloud

mme2e_log "Test cloud customer deleted, MM_CUSTOMER_ID: $MM_CUSTOMER_ID."
