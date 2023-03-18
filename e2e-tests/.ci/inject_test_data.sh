#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

# Inject test data, prepare for E2E tests
mme2e_log "Injecting E2E test data"
${MME2E_DOCKER_COMPOSE} exec -T -- server mmctl config set TeamSettings.MaxUsersPerTeam 100 --local
${MME2E_DOCKER_COMPOSE} exec -T -- server mmctl sampledata -u 60 --local
${MME2E_DOCKER_COMPOSE} exec -T -- openldap bash -c 'ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest' <../../server/tests/test-data.ldif
${MME2E_DOCKER_COMPOSE} exec -T -- minio sh -c 'mkdir -p /data/mattermost-test'
mme2e_log "Mattermost is running and ready for E2E testing"
mme2e_log "You can use the test data credentials for logging in (username=sysadmin password=Sys@dmin-sample1)"
