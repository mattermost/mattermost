#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc
. .e2erc_setup

mme2e_log "Stopping E2E containers"
${MME2E_DC_SERVER} down -v --remove-orphans
