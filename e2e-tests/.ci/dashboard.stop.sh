#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

if [ -d dashboard ]; then
  mme2e_log "Stopping the dashboard containers"
  ${MME2E_DC_DASHBOARD} down
else
  # Base docker-compose file is found in the dashboard repo, we can't run docker commands without it
  mme2e_log "Not stopping the dashboard containers: dashboard repo not checked out locally, skipping"
fi
