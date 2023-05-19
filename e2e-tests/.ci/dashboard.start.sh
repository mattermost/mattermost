#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

MME2E_DASHBOARD_REF_DEFAULT="origin/main"
MME2E_DASHBOARD_REF=${MME2E_DASHBOARD_REF:-$MME2E_DASHBOARD_REF_DEFAULT}

mme2e_log "Cloning the automation-dashboard project"
[ -d dashboard ] || git clone https://github.com/saturninoabril/automation-dashboard.git dashboard
git -C dashboard fetch
git -C dashboard checkout $MME2E_DASHBOARD_REF

mme2e_log "Starting the dashboard"
${MME2E_DC_DASHBOARD} up -d db dashboard

mme2e_log "Generating the dashboard's local URL"
MME2E_DC_DASHBOARD_NETWORK=$(${MME2E_DC_DASHBOARD} ps -q dashboard | xargs -l docker inspect | jq -r '.[0].NetworkSettings.Networks | (keys|.[0])')
MME2E_DC_DASHBOARD_GATEWAY=$(docker network inspect $MME2E_DC_DASHBOARD_NETWORK | jq -r '.[0].IPAM.Config[0].Gateway')
AUTOMATION_DASHBOARD_URL="http://${MME2E_DC_DASHBOARD_GATEWAY}:4000/api"

mme2e_log "Generating a signed JWT token for accessing the dashboard"
AUTOMATION_DASHBOARD_TOKEN=$(${MME2E_DC_DASHBOARD} exec -T -u $MME2E_UID dashboard node script/sign.js | awk '{ print $2; }') # The token secret is specified in the dashboard.override.yml file

mme2e_log "Generating the .env.dashboard file, to point Cypress to the dashboard URL"
mme2e_generate_envfile_from_var_names >.env.dashboard <<EOF
AUTOMATION_DASHBOARD_URL
AUTOMATION_DASHBOARD_TOKEN
EOF
