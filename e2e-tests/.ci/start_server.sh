#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

: ${MM_SERVER_IMAGE:?}

# Launch mattermost-server, and wait for it to be healthy
mme2e_log "Starting E2E containers"
mme2e_wait_image ${MM_SERVER_IMAGE} 30 60
${MME2E_DOCKER_COMPOSE} up -d --force-recreate -V
if ! mme2e_wait_service_healthy server 60 10; then
  mme2e_log "Mattermost container not healthy, retry attempts exhausted. Giving up." >&2
  exit 1
fi
mme2e_log "Mattermost container is running and healthy"
