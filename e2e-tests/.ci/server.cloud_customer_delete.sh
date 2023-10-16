#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

if [ "$SERVER" != "cloud" ]; then
  mme2e_log "Not applicable to SERVER='$SERVER'. For cloud only."
  exit 0
fi

mme2e_log "Loading .env.server.cloud"
. .env.server.cloud

# Check if CWS_URL is set or not
if [ -n "${CWS_URL-}" ] && [ -n "$CWS_URL" ]; then
  mme2e_log "CWS_URL is set."
else
  mme2e_log "Environment variable CWS_URL is empty or unset. It must be set to delete test cloud customer."
  exit 1
fi

mme2e_log "Deleting customer $MM_CUSTOMER_ID."
curl -X DELETE "${CWS_URL}/api/v1/internal/tests/customers/$MM_CUSTOMER_ID/payment-customer"

mme2e_log "Test cloud customer deleted, MM_CUSTOMER_ID: $MM_CUSTOMER_ID."
