#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

if [ "$SERVER" != "local" ] || [ "$TEST" != "cypress" ]; then
  mme2e_log "Skipping local webhook bootstrap: SERVER=$SERVER TEST=$TEST"
  exit 0
fi

mkdir -p "$(dirname "$MME2E_CYPRESS_WEBHOOK_LOG")"

if mme2e_wait_url_ok "http://localhost:3000/" 1 1; then
  mme2e_log "Local Cypress webhook server is already healthy"
  exit 0
fi

mme2e_log "Starting local Cypress webhook server"
(
  cd ../cypress
  mme2e_use_nvm_node_version
  node webhook_serve.js webhook-interactions >>"$MME2E_CYPRESS_WEBHOOK_LOG" 2>&1
) &

if ! mme2e_wait_url_ok "http://localhost:3000/" 30 2; then
  mme2e_log "Local Cypress webhook server failed to become healthy" >&2
  exit 1
fi

mme2e_log "Local Cypress webhook server is running"
