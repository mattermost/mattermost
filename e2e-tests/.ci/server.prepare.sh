#!/bin/bash
set -e -u -o pipefail -x
cd $(dirname $0)
. .e2erc

# Install cypress dependencies
mme2e_log "Prepare Cypress: install dependencies"
${MME2E_DC_SERVER} exec -T -u 0 -- cypress bash -c "id $MME2E_UID || useradd -u $MME2E_UID -m nodeci" # Works around the node image's assumption that the app files are owned by user 1000
${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress npm i
${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress cypress install

# Populate cypress fixtures
mme2e_log "Prepare Cypress: populating fixtures"
${MME2E_DC_SERVER} exec -T -- server curl -L --silent https://github.com/mattermost/mattermost-plugin-gitlab/releases/download/v1.3.0/com.github.manland.mattermost-plugin-gitlab-1.3.0.tar.gz | ${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress tee tests/fixtures/com.github.manland.mattermost-plugin-gitlab-1.3.0.tar.gz >/dev/null
${MME2E_DC_SERVER} exec -T -- server curl -L --silent https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.9.0/com.mattermost.demo-plugin-0.9.0.tar.gz | ${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress tee tests/fixtures/com.mattermost.demo-plugin-0.9.0.tar.gz >/dev/null
${MME2E_DC_SERVER} exec -T -- server curl -L --silent https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.8.0/com.mattermost.demo-plugin-0.8.0.tar.gz | ${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress tee tests/fixtures/com.mattermost.demo-plugin-0.8.0.tar.gz >/dev/null
${MME2E_DC_SERVER} exec -T -- server curl -L --silent https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.8.0/com.mattermost.demo-plugin-0.8.0.tar.gz | ${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress tee tests/fixtures/com.mattermost.demo-plugin-0.8.0.tar.gz >/dev/null
${MME2E_DC_SERVER} exec -T -u $MME2E_UID -- cypress tee tests/fixtures/keycloak.crt >/dev/null <../../server/build/docker/keycloak/keycloak.crt

# Inject test data, prepare for E2E tests
mme2e_log "Prepare Server: injecting E2E test data"
${MME2E_DC_SERVER} exec -T -- server mmctl config set TeamSettings.MaxUsersPerTeam 100 --local
${MME2E_DC_SERVER} exec -T -- server mmctl sampledata -u 60 --local
${MME2E_DC_SERVER} exec -T -- openldap bash -c 'ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest' <../../server/tests/test-data.ldif
${MME2E_DC_SERVER} exec -T -- minio sh -c 'mkdir -p /data/mattermost-test'
mme2e_log "Mattermost is running and ready for E2E testing"
mme2e_log "You can use the test data credentials for logging in (username=sysadmin password=Sys@dmin-sample1)"
