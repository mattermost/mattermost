#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

if [ "$SERVER" != "cloud" ]; then
  mme2e_log "Skipping cloud instance teardown: operation supported only for cloud server, but running with SERVER='$SERVER'"
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
curl -X DELETE "${CWS_URL}/api/v1/internal/tests/customers/$MM_CUSTOMER_ID/payment-customer"

mme2e_log "Test cloud customer deleted, MM_CUSTOMER_ID: $MM_CUSTOMER_ID."
