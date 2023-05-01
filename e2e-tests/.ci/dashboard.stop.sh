#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

${MME2E_DC_DASHBOARD} down
