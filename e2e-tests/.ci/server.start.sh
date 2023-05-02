#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

: ${SERVER_IMAGE:?}

# Cleanup old containers, if any
mme2e_log "Stopping leftover E2E containers, if any are running"
${MME2E_DC_SERVER} down -v

# Initialize docker-compose resources
mme2e_log "Creating docker-compose network + containers"
mme2e_wait_image ${SERVER_IMAGE} 30 60
${MME2E_DC_SERVER} up --no-start

# Generate .env.server
mme2e_log "Generating .env.server"
cat >.env.server <<EOF
MM_LICENSE=$MM_LICENSE
EOF
[ -z "${AUTOMATION_DASHBOARD_URL:-}" ]   || echo "AUTOMATION_DASHBOARD_URL=$AUTOMATION_DASHBOARD_URL"     >>.env.server
[ -z "${AUTOMATION_DASHBOARD_TOKEN:-}" ] || echo "AUTOMATION_DASHBOARD_TOKEN=$AUTOMATION_DASHBOARD_TOKEN" >>.env.server
envarr=$(echo ${MM_ENV:-} | tr "," "\n")
for env in $envarr; do
  echo "> [$env]"
  echo "$env" >> ".env.server"
done

# Generate .env.cypress
mme2e_log "Generating .env.cypress"
cat >.env.cypress <<EOF
BRANCH=$BRANCH
BUILD_ID=$BUILD_ID
EOF

# Launch mattermost-server, and wait for it to be healthy
mme2e_log "Starting E2E containers"
${MME2E_DC_SERVER} up -d
if ! mme2e_wait_service_healthy server 60 10; then
  mme2e_log "Mattermost container not healthy, retry attempts exhausted. Giving up." >&2
  exit 1
fi
mme2e_log "Mattermost container is running and healthy"
