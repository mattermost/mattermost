#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

export BRANCH_DEFAULT=$(git branch --show-current)
export BRANCH=${BRANCH:-$BRANCH_DEFAULT}
export BUILD_ID_DEFAULT=$(date +%s)
export BUILD_ID=${BUILD_ID:-$BUILD_ID_DEFAULT}
export CI_BASE_URL="${CI_BASE_URL:-localhost}"

# Cleanup old containers, if any
mme2e_log "Stopping leftover E2E containers, if any are running"
${MME2E_DC_SERVER} down -v

# Generate .env.server
mme2e_log "Generating .env.server"
mme2e_generate_envfile_from_var_names >.env.server <<EOF
MM_LICENSE
EOF
envarr=$(echo ${MM_ENV:-} | tr "," "\n")
for env in $envarr; do
  echo "$env" >> .env.server
done

# Generate .env.cypress
mme2e_log "Generating .env.cypress"
mme2e_generate_envfile_from_var_names >.env.cypress <<EOF
BRANCH
BUILD_ID
CI_BASE_URL
AUTOMATION_DASHBOARD_URL
AUTOMATION_DASHBOARD_TOKEN
EOF

# Wait for the required server image
mme2e_log "Waiting for server image to be available"
mme2e_wait_image ${SERVER_IMAGE} 30 60

# Create the containers and generate the server config
mme2e_log "Creating E2E containers and generating server config"
${MME2E_DC_SERVER} create
${MME2E_DC_SERVER} up -d -- utils
${MME2E_DC_SERVER} exec -T  -- utils bash -c "apt update && apt install -y jq"
${MME2E_DC_SERVER} exec -T -e "OUTPUT_CONFIG=/tmp/config_generated.json" -w /opt/mattermost-server/server -- utils go run scripts/config_generator/main.go
${MME2E_DC_SERVER} exec -T -- utils bash <<EOF
jq "
  .ServiceSettings.SiteURL=\"http://server:8065\"
| .PluginSettings.Enable=true
| .PluginSettings.EnableUploads=true
| .PluginSettings.AutomaticPrepackagedPlugins=true
| .TeamSettings.EnableOpenServer=true
| .ElasticsearchSettings.ConnectionURL=\"http://elasticsearch:9200\"
" </tmp/config_generated.json >/opt/server-config/config.json
EOF

# Launch mattermost-server, and wait for it to be healthy
mme2e_log "Starting E2E containers"
${MME2E_DC_SERVER} up -d
if ! mme2e_wait_service_healthy server 60 10; then
  mme2e_log "Mattermost container not healthy, retry attempts exhausted. Giving up." >&2
  exit 1
fi
mme2e_log "Mattermost container is running and healthy"
