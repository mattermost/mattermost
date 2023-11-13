#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

if [ "$SERVER" != "cloud" ]; then
  mme2e_log "Skipping cloud instance initialization: operation supported only for cloud server, but running with SERVER='$SERVER'"
  exit 0
fi

mme2e_log "Initializing cloud tests"

# Assert that required variables are set
MME2E_ENVCHECK_MSG="variable required for initializing cloud tests, but is empty or unset."
: "${CWS_URL:?$MME2E_ENVCHECK_MSG}"
: "${MM_LICENSE:?$MME2E_ENVCHECK_MSG}"

response=$(curl -X POST "${CWS_URL}/api/v1/internal/tests/create-customer?sku=cloud-enterprise&is_paid=true")
MM_CUSTOMER_ID=$(echo "$response" | jq -r .customer_id)
MM_CLOUD_API_KEY=$(echo "$response" | jq -r .api_key)
MM_CLOUD_INSTALLATION_ID=$(echo "$response" | jq -r .installation_id)

export MM_CUSTOMER_ID=$MM_CUSTOMER_ID
export MM_CLOUD_API_KEY=$MM_CLOUD_API_KEY
export MM_CLOUD_INSTALLATION_ID=$MM_CLOUD_INSTALLATION_ID
export MM_CLOUDSETTINGS_CWSURL=$CWS_URL
export MM_CLOUDSETTINGS_CWSAPIURL=$CWS_URL

mme2e_generate_envfile_from_var_names >.env.cloud <<EOF
MM_CLOUDSETTINGS_CWSURL
MM_CLOUDSETTINGS_CWSAPIURL
MM_CLOUD_API_KEY
MM_CUSTOMER_ID
MM_CLOUD_INSTALLATION_ID
EOF

mme2e_log "Test cloud customer created, MM_CUSTOMER_ID: $MM_CUSTOMER_ID."
