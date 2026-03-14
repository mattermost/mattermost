#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

if [ "$SERVER" != "local" ]; then
  mme2e_log "Skipping local source server bootstrap: SERVER=$SERVER"
  exit 0
fi

mkdir -p "$(dirname "$MME2E_LOCAL_SERVER_LOG")"

if mme2e_wait_url_ok "http://localhost:8065/api/v4/system/ping" 1 1; then
  mme2e_log "Local Mattermost source server is already healthy"
  exit 0
fi

mme2e_log "Starting local Mattermost source server"
(
  cd "$MME2E_LOCAL_SERVER_ROOT"
  export PATH=/usr/local/go/bin:$PATH
  mme2e_use_nvm_node_version
  if [ -n "${TEST_LICENSE:-}" ] && [ -z "${MM_LICENSE:-}" ]; then
    export MM_LICENSE="$TEST_LICENSE"
  fi
  export MM_PLUGINSETTINGS_ENABLEUPLOADS=true
  export MM_PLUGINSETTINGS_ENABLE=true
  export MM_SERVICESETTINGS_ENABLELOCALMODE=true
  export MM_SERVICESETTINGS_SITEURL=http://localhost:8065
  make BUILD_ENTERPRISE_DIR="$HOME/enterprise" run >>"$MME2E_LOCAL_SERVER_LOG" 2>&1
) &

if ! mme2e_wait_url_ok "http://localhost:8065/api/v4/system/ping" 120 2; then
  mme2e_log "Local Mattermost source server failed to become healthy" >&2
  exit 1
fi

mme2e_log "Local Mattermost source server is running"
