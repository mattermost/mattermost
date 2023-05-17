#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

export MME2E_BRANCH_DEFAULT=$(git branch --show-current)
export MME2E_BRANCH=${MME2E_BRANCH:-$MME2E_BRANCH_DEFAULT}
export MME2E_BUILD_ID_DEFAULT=$(date +%s)
export MME2E_BUILD_ID=${MME2E_BUILD_ID:-$MME2E_BUILD_ID_DEFAULT}

# Cleanup old containers, if any
mme2e_log "Stopping leftover E2E containers, if any are running"
${MME2E_DC_SERVER} down -v

# Generate .env.server
mme2e_log "Generating .env.server"
cat >.env.server <<<""
[ -z "${MM_LICENSE:-}" ] || echo "MM_LICENSE=$MM_LICENSE" >>.env.server
envarr=$(echo ${MM_ENV:-} | tr "," "\n")
for env in $envarr; do
  echo "> [$env]"
  echo "$env" >> ".env.server"
done

# Generate .env.cypress
mme2e_log "Generating .env.cypress"
cat >.env.cypress <<EOF
BRANCH=$MME2E_BRANCH
BUILD_ID=$MME2E_BUILD_ID
EOF
mme2e_generate_envfile_from_vars AUTOMATION_DASHBOARD_URL AUTOMATION_DASHBOARD_TOKEN >>.env.cypress

# Launch mattermost-server, and wait for it to be healthy
mme2e_log "Waiting for server image to be available"
mme2e_wait_image ${MME2E_SERVER_IMAGE} 30 60
mme2e_log "Starting E2E containers"
${MME2E_DC_SERVER} up -d
if ! mme2e_wait_service_healthy server 60 10; then
  mme2e_log "Mattermost container not healthy, retry attempts exhausted. Giving up." >&2
  exit 1
fi
mme2e_log "Mattermost container is running and healthy"
