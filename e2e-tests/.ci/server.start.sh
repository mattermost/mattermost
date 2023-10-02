#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

if [ "$TEST" != "cypress" ] && [ "$TEST" != "playwright" ] && [ "$TEST" != "server" ]; then
  mme2e_log "Invalid TEST='$TEST', expected: 'cypress', 'playwright' or 'server'"
  exit 1
fi

BRANCH_DEFAULT=$(git branch --show-current)
export BRANCH=${BRANCH:-$BRANCH_DEFAULT}
BUILD_ID_DEFAULT=$(date +%s)
export BUILD_ID=${BUILD_ID:-$BUILD_ID_DEFAULT}
export CI_BASE_URL="${CI_BASE_URL:-localhost}"
export SITE_URL="${SITE_URL:-http://server:8065}"

# Cleanup old containers, if any
mme2e_log "Stopping leftover E2E containers, if any are running"
${MME2E_DC_SERVER} down -v --remove-orphans

# Generate .env.server
mme2e_log "Generating .env.server"
mme2e_generate_envfile_from_var_names >.env.server <<EOF
MM_CLOUDSETTINGS_CWSURL
MM_CLOUDSETTINGS_CWSAPIURL
MM_CLOUD_API_KEY
MM_CUSTOMER_ID
MM_CLOUD_INSTALLATION_ID
MM_ELASTICSEARCHSETTINGS_CONNECTIONURL
MM_LDAPSETTINGS_LDAPSERVER
EOF
# shellcheck disable=SC2086
envarr=$(echo ${MM_ENV:-} | tr "," "\n")
for env in $envarr; do
  echo "$env" >>.env.server
done

if [ "$TEST" = "cypress" ]; then
  mme2e_log "Cypress: Preparing server setup"

  # Load .e2erc_cypress
  . .e2erc_cypress

  # Generate .env.cypress
  mme2e_log "Cypress: Generating .env.cypress"
  mme2e_generate_envfile_from_var_names >.env.cypress <<EOF
BRANCH
BUILD_ID
CI_BASE_URL
BROWSER
AUTOMATION_DASHBOARD_URL
AUTOMATION_DASHBOARD_TOKEN
EOF

  # Additional variables to .env.cypress
  if [[ $ENABLED_DOCKER_SERVICES == *"openldap"* ]]; then
    echo "CYPRESS_ldapServer=openldap" >>.env.cypress
    echo "CYPRESS_runLDAPSync=true" >>.env.cypress
  fi

  if [[ $ENABLED_DOCKER_SERVICES == *"minio"* ]]; then
    echo "CYPRESS_minioS3Endpoint=minio:9000" >>.env.cypress
  fi

  if [[ $ENABLED_DOCKER_SERVICES == *"keycloak"* ]]; then
    echo "CYPRESS_keycloakBaseUrl=http://keycloak:8484" >>.env.cypress
  fi

  if [[ $ENABLED_DOCKER_SERVICES == *"elasticsearch"* ]]; then
    echo "CYPRESS_elasticsearchConnectionURL=http://elasticsearch:9200" >>.env.cypress
  fi

  if [ "$SERVER" = "cloud" ]; then
    echo "CYPRESS_serverEdition=Cloud" >>.env.cypress
  else
    echo "CYPRESS_serverEdition=E20" >>.env.cypress
  fi
elif [ "$TEST" = "playwright" ]; then
  mme2e_log "Playwright: Preparing server setup"

  # Load .e2erc_playwright
  . .e2erc_playwright

  # Generate .env.playwright
  mme2e_log "Playwright: Generating .env.playwright"
  mme2e_generate_envfile_from_var_names >.env.playwright <<EOF
BRANCH
BUILD_ID
EOF
else
  mme2e_log "Preparing server setup only"
fi

if [ $# -gt 1 ] && [ "$2" = "cloud" ]; then
  echo "MM_NOTIFY_ADMIN_COOL_OFF_DAYS=0.00000001" >>.env.server
  echo 'MM_FEATUREFLAGS_ANNUALSUBSCRIPTION="true"' >>.env.server
fi

# Wait for the required server image
mme2e_log "Waiting for server image to be available"
mme2e_wait_image "$SERVER_IMAGE" 30 60

# Launch mattermost-server, and wait for it to be healthy
mme2e_log "Starting E2E containers"
${MME2E_DC_SERVER} create
${MME2E_DC_SERVER} up -d
if ! mme2e_wait_service_healthy server 60 10; then
  mme2e_log "Mattermost container not healthy, retry attempts exhausted. Giving up." >&2
  exit 1
fi
mme2e_log "Mattermost container is running and healthy"
