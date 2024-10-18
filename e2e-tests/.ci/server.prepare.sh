#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

mme2e_log "Configuring starting server parameters that may be changed at runtime"
for SETTING in \
    TeamSettings.EnableOpenServer=true \
    PluginSettings.Enable=true \
    PluginSettings.EnableUploads=true \
    PluginSettings.AutomaticPrepackagedPlugins=true
  do
  mme2e_log "Configuring parameter: $SETTING"
  # shellcheck disable=SC2046
  ${MME2E_DC_SERVER} exec -T -- server mmctl --local config set $(tr '=' ' ' <<<$SETTING)
done
if [ -n "${MM_LICENSE:-}" ]; then
  # We prefer uploading the license here, instead of setting the env var for the server
  # This is to retain the flexibility of being able to remove it programmatically, if the tests require it
  mme2e_log "Uploading license to server"
  ${MME2E_DC_SERVER} exec -T -- server mmctl --local license upload-string "$MM_LICENSE"
fi

if [ "$TEST" = "cypress" ]; then
  mme2e_log "Prepare Cypress: install dependencies"
  ${MME2E_DC_SERVER} exec -T -u 0 -- cypress bash -c "id $MME2E_UID || useradd -u $MME2E_UID -m nodeci" # Works around the node image's assumption that the app files are owned by user 1000
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress npm i
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress cypress install
  mme2e_log "Prepare Cypress: populating fixtures"
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress tee tests/fixtures/keycloak.crt >/dev/null <../../server/build/docker/keycloak/keycloak.crt
  for PLUGIN_URL in \
    "https://github.com/mattermost/mattermost-plugin-gitlab/releases/download/v1.3.0/com.github.manland.mattermost-plugin-gitlab-1.3.0.tar.gz" \
    "https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.9.0/com.mattermost.demo-plugin-0.9.0.tar.gz" \
    "https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.8.0/com.mattermost.demo-plugin-0.8.0.tar.gz"
  do
    PLUGIN_NAME="${PLUGIN_URL##*/}"
    PLUGIN_PATH="tests/fixtures/$PLUGIN_NAME"
    if ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress test -f "$PLUGIN_PATH"; then
      mme2e_log "Skipping installation of plugin $PLUGIN_NAME: file exists"
      continue
    fi
    mme2e_log "Downloading $PLUGIN_NAME to fixtures directory"
    ${MME2E_DC_SERVER} exec -T -- server curl -L --silent "${PLUGIN_URL}" | ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress tee "$PLUGIN_PATH" >/dev/null
  done
fi

# Run service-specific initialization steps
for SERVICE in $ENABLED_DOCKER_SERVICES; do
  case "$SERVICE" in
  openldap)
    LDIF_FILE=../../server/tests/test-data.ldif
    LDIF_CANARY=$(sed -n -E 's/^dn:[[:space:]]*(.*)$/\1/p' ${LDIF_FILE} | tail -n1)
    if ${MME2E_DC_SERVER} exec -T -- openldap bash -c "ldapsearch -x -D \"cn=admin,dc=mm,dc=test,dc=com\" -w mostest -b \"$LDIF_CANARY\" >/dev/null"; then
      mme2e_log "Skipping configuration for the $SERVICE container: already initialized"
      continue
    fi
    mme2e_log "Configuring the $SERVICE container"
    ${MME2E_DC_SERVER} exec -T -- openldap bash -c 'ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest' <../../server/tests/test-data.ldif
    ;;
  minio)
    mme2e_log "Configuring the $SERVICE container"
    ${MME2E_DC_SERVER} exec -T -- minio sh -c 'mkdir -p /data/mattermost-test'
    ;;
  esac
done

mme2e_log "Mattermost is running and ready for E2E testing"
