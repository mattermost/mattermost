#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

MME2E_DASHBOARD_REF_DEFAULT="origin/main"
MME2E_DASHBOARD_REF=${MME2E_DASHBOARD_REF:-$MME2E_DASHBOARD_REF_DEFAULT}

mme2e_log "Cloning the automation-dashboard project"
if [ ! -d dashboard ]; then
  git clone https://github.com/saturninoabril/automation-dashboard.git dashboard
  . .e2erc # Must reinitialize some variables that depend on the dashboard repo being checked out
fi
git -C dashboard fetch
git -C dashboard checkout $MME2E_DASHBOARD_REF

mme2e_log "Starting the dashboard"
${MME2E_DC_DASHBOARD} up -d db dashboard

mme2e_log "Generating the dashboard's local URL"
case $MME2E_OSTYPE in
  darwin )
    AUTOMATION_DASHBOARD_IP=$(ifconfig $(route get 1.1.1.1 | grep interface | awk '{print $2}') | grep -w inet | awk '{print $2}') ;;
  * )
    MME2E_DC_DASHBOARD_NETWORK=$(docker inspect $(${MME2E_DC_DASHBOARD} ps -q dashboard) | jq -r '.[0].NetworkSettings.Networks | (keys|.[0])')
    AUTOMATION_DASHBOARD_IP=$(docker network inspect $MME2E_DC_DASHBOARD_NETWORK | jq -r '.[0].IPAM.Config[0].Gateway')
esac
AUTOMATION_DASHBOARD_URL="http://${AUTOMATION_DASHBOARD_IP}:4000/api"

mme2e_log "Generating a signed JWT token for accessing the dashboard"
${MME2E_DC_DASHBOARD} exec -T dashboard npm i
AUTOMATION_DASHBOARD_TOKEN=$(${MME2E_DC_DASHBOARD} exec -T dashboard node script/sign.js | awk '{ print $2; }') # The token secret is specified in the dashboard.override.yml file

mme2e_log "Generating the .env.dashboard file, to point Cypress to the dashboard URL"
mme2e_generate_envfile_from_var_names >.env.dashboard <<EOF
AUTOMATION_DASHBOARD_URL
AUTOMATION_DASHBOARD_TOKEN
EOF
