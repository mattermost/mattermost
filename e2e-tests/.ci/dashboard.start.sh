#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

[ -d dashboard ] || git clone https://github.com/saturninoabril/automation-dashboard.git dashboard
# git -C dashboard fetch
# git -C dashboard checkout $DASHBOARD_REF
${MME2E_DC_DASHBOARD} up -d db dashboard
