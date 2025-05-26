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
  # Create user in Cypress container
  mme2e_log "Creating user for Cypress container"
  ${MME2E_DC_SERVER} exec -T -u 0 -- cypress bash -c "
# Check if user already exists
if ! id $MME2E_UID > /dev/null 2>&1; then
  # Try to create user with useradd
  if ! useradd -u $MME2E_UID -m nodeci > /dev/null 2>&1; then
    # Fall back to manual user creation
    echo \"nodeci:x:$MME2E_UID:$MME2E_UID:nodeci:/home/nodeci:/bin/bash\" >> /etc/passwd
    mkdir -p /home/nodeci
    chown $MME2E_UID:$MME2E_UID /home/nodeci
  fi
fi" || mme2e_log "WARNING: User creation failed, but continuing anyway"
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress npm i
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress cypress install
  mme2e_log "Prepare Cypress: populating fixtures"
  ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress tee tests/fixtures/keycloak.crt >/dev/null <../../server/build/docker/keycloak/keycloak.crt
  # Download plugins using wget in the Cypress container

  for PLUGIN_URL in \
    "https://github.com/mattermost/mattermost-plugin-gitlab/releases/download/v1.3.0/com.github.manland.mattermost-plugin-gitlab-1.3.0.tar.gz" \
    "https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.9.0/com.mattermost.demo-plugin-0.9.0.tar.gz" \
    "https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.8.0/com.mattermost.demo-plugin-0.8.0.tar.gz"
  do
    PLUGIN_NAME="${PLUGIN_URL##*/}"
    PLUGIN_PATH="tests/fixtures/$PLUGIN_NAME"

    # Ensure the directory exists
    ${MME2E_DC_SERVER} exec -T -- cypress bash -c "ls -la /cypress/tests/fixtures || mkdir -p /cypress/tests/fixtures"

    # Check if file exists
    if ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress test -f "$PLUGIN_PATH"; then
      mme2e_log "Skipping installation of plugin $PLUGIN_NAME: file exists"
      continue
    fi

    # Use wget instead of curl for distroless compatibility
    mme2e_log "Downloading $PLUGIN_NAME to fixtures directory"
    ${MME2E_DC_SERVER} exec -T -u "$MME2E_UID" -- cypress wget -q -O "/cypress/$PLUGIN_PATH" "$PLUGIN_URL" || mme2e_log "ERROR: wget download failed"
  done

  mme2e_log "Plugin download process complete"
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
    ${MME2E_DC_SERVER} exec -T openldap bash -c 'ldapadd -Y EXTERNAL -H ldapi:/// -w mostest || true' <../../server/tests/custom-schema-objectID.ldif
    ${MME2E_DC_SERVER} exec -T -- openldap bash -c 'ldapadd -Y EXTERNAL -H ldapi:/// -w mostest || true' < ../../server/tests/custom-schema-cpa.ldif
    ${MME2E_DC_SERVER} exec -T -- openldap bash -c 'ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest' <../../server/tests/test-data.ldif
    ;;
  minio)
    mme2e_log "Configuring the $SERVICE container"
    ${MME2E_DC_SERVER} exec -T -- minio sh -c 'mkdir -p /data/mattermost-test'
    ;;
  esac
done

mme2e_log "Mattermost is running and ready for E2E testing"
