#!/bin/bash
# SC2034: <variable> appears unused.
# https://www.shellcheck.net/wiki/SC2034
# shellcheck disable=SC2034
# Note: Variables are dynamically used depending on usage input (ENABLED_DOCKER_SERVICES)

set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

is_service_in_list() {
  local SERVICE_NAME=$1
  local SERVICE_LIST=$2
  grep -qE "(^| )$SERVICE_NAME( |$)" <<<"$SERVICE_LIST"
}

enable_docker_service() {
  local SERVICE_TO_ENABLE="$1"
  if ! is_service_in_list "$SERVICE_TO_ENABLE" "$ENABLED_DOCKER_SERVICES"; then
    ENABLED_DOCKER_SERVICES="$ENABLED_DOCKER_SERVICES $SERVICE_TO_ENABLE"
  fi
}

assert_services_validity() {
  local SERVICES_TO_CHECK="$*"
  local SERVICES_VALID="postgres minio inbucket openldap elasticsearch keycloak cypress webhook-interactions playwright"
  local SERVICES_REQUIRED="postgres inbucket"
  for SERVICE_NAME in $SERVICES_TO_CHECK; do
    if ! is_service_in_list "$SERVICE_NAME" "$SERVICES_VALID"; then
      mme2e_log "Error, requested invalid service: $SERVICE_NAME" >&2
      mme2e_log "Valid services are: $SERVICES_VALID" >&2
      mme2e_log "Aborting" >&2
      exit 1
    fi
    SERVICES_REQUIRED="${SERVICES_REQUIRED/$SERVICE_NAME/}"
  done
  if [ -n "${SERVICES_REQUIRED/ /}" ]; then
    mme2e_log "Missing required services: $SERVICES_REQUIRED" >&2
    mme2e_log "Aborting" >&2
    exit 2
  fi
}

ensure_optional_files_exist() {
  # Create files required to exist, but whose existence depends on optional services (e.g. dashboard)
  touch .env.dashboard
  touch .env.server.cloud
}

echo_docker_compose_textblock_for_service() {
  local SERVICE_NAME="$1"
  local SERVICE_VARIABLE_NAME="$SERVICE_NAME"

  # The variable containing the docker-compose text block for a certain service is not always named
  # the same as the service (e.g. characters that are valid for docker-compose services, but not allowed
  # for variable names).
  # If required, rewrite the variable name before printing the variable's value
  case $SERVICE_NAME in
  elasticsearch)
    [ "$MME2E_ARCHTYPE" = "arm64" ] && SERVICE_VARIABLE_NAME="elasticsearch_arm64"
    ;;
  webhook-interactions)
    SERVICE_VARIABLE_NAME="webhook_interactions"
    ;;
  esac

  echo "${!SERVICE_VARIABLE_NAME}"
}

# Define each service's docker-compose text block values
postgres='
  postgres:
    image: mattermostdevelopment/mirrored-postgres:12
    restart: always
    environment:
      POSTGRES_USER: mmuser
      POSTGRES_PASSWORD: mostest
      POSTGRES_DB: mattermost_test
    command: postgres -c "config_file=/etc/postgresql/postgresql.conf"
    volumes:
      - ../../server/build/docker/postgres.conf:/etc/postgresql/postgresql.conf
    healthcheck:
      test: ["CMD", "pg_isready", "-h", "localhost"]
      interval: 10s
      timeout: 15s
      retries: 12
    networks:
      default:
        aliases:
        - postgres'

inbucket='
  inbucket:
    restart: "no"
    container_name: mattermost-inbucket
    ports:
      - "9001:9001"
      - "10025:10025"
      - "10110:10110"
    extends:
        file: ../../server/build/gitlab-dc.common.yml
        service: inbucket'

minio='
  minio:
    restart: "no"
    container_name: mattermost-minio
    ports:
      - "9000:9000"
    extends:
      file: ../../server/build/gitlab-dc.common.yml
      service: minio'

openldap='
  openldap:
    restart: "no"
    container_name: mattermost-openldap
    ports:
      - "389:389"
      - "636:636"
    extends:
        file: ../../server/build/gitlab-dc.common.yml
        service: openldap'

elasticsearch='
  elasticsearch:
    restart: "no"
    container_name: mattermost-elasticsearch
    ports:
      - "9200:9200"
      - "9300:9300"
    extends:
        file: ../../server/build/gitlab-dc.common.yml
        service: elasticsearch'

elasticsearch_arm64='
  elasticsearch:
    image: mattermostdevelopment/mattermost-elasticsearch:7.17.10
    platform: linux/arm64/v8
    restart: "no"
    container_name: mattermost-elasticsearch
    ports:
      - "9200:9200"
      - "9300:9300"
    extends:
        file: ../../server/build/gitlab-dc.common.yml
        service: elasticsearch'

keycloak='
  keycloak:
    restart: "no"
    container_name: mattermost-keycloak
    ports:
      - "8484:8080"
    extends:
        file: ../../server/build/gitlab-dc.common.yml
        service: keycloak'

cypress='
  cypress:
    image: "cypress/browsers:node-18.16.1-chrome-114.0.5735.133-1-ff-114.0.2-edge-114.0.1823.51-1"
    ### Temporarily disabling this image, until both the amd64 and arm64 version are mirrored
    # image: "mattermostdevelopment/mirrored-cypress-browsers-public:node-18.16.1-chrome-114.0.5735.133-1-ff-114.0.2-edge-114.0.1823.51-1"
    entrypoint: ["/bin/bash", "-c"]
    command: ["until [ -f /var/run/mm_terminate ]; do sleep 5; done"]
    env_file:
      - "../../e2e-tests/.ci/.env.dashboard"
      - "../../e2e-tests/.ci/.env.cypress"
    environment:
      REPO: "mattermost"
      # Cypress configuration
      HEADLESS: "true"
      CYPRESS_baseUrl: "http://server:8065"
      CYPRESS_dbConnection: "postgres://mmuser:mostest@postgres:5432/mattermost_test?sslmode=disable&connect_timeout=10"
      CYPRESS_smtpUrl: "http://inbucket:9001"
      CYPRESS_webhookBaseUrl: "http://webhook-interactions:3000"
      CYPRESS_chromeWebSecurity: "false"
      CYPRESS_firstTest: "true"
      CYPRESS_resetBeforeTest: "true"
      CYPRESS_allowedUntrustedInternalConnections: "localhost webhook-interactions"
      TM4J_ENABLE: "false"
      # disable shared memory X11 affecting Cypress v4 and Chrome
      # https://github.com/cypress-io/cypress-docker-images/issues/270
      QT_X11_NO_MITSHM: "1"
      _X11_NO_MITSHM: "1"
      _MITSHM: "0"
      # avoid too many progress messages
      # https://github.com/cypress-io/cypress/issues/1243
      CI: "1"
      # Ensure we are independent from the global node environment
      PATH: /cypress/node_modules/.bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    ulimits:
      nofile:
        soft: 8096
        hard: 1048576
    working_dir: /cypress
    volumes:
      - "../../e2e-tests/cypress/:/cypress"'

# shellcheck disable=SC2016
webhook_interactions='
  webhook-interactions:
    image: mattermostdevelopment/mirrored-node:${NODE_VERSION_REQUIRED}
    command: sh -c "npm install --legacy-peer-deps && exec node webhook_serve.js"
    environment:
      NODE_PATH: /usr/local/lib/node_modules/
    healthcheck:
      test: ["CMD", "curl", "-s", "-o/dev/null", "127.0.0.1:3000"]
      interval: 10s
      timeout: 15s
      retries: 12
    working_dir: /cypress
    volumes:
      - "../../e2e-tests/cypress/:/cypress:ro"
    networks:
      default:
        aliases:
          - webhook-interactions'

playwright='
  playwright:
    image: mcr.microsoft.com/playwright:v1.38.1-jammy
    entrypoint: ["/bin/bash", "-c"]
    command: ["until [ -f /var/run/mm_terminate ]; do sleep 5; done"]
    env_file:
      - "./.env.playwright"
    environment:
      CI: "true"
      NODE_OPTIONS: --no-experimental-fetch
      PW_BASE_URL: http://server:8065
      PW_ADMIN_USERNAME: sysadmin
      PW_ADMIN_PASSWORD: Sys@dmin-sample1
      PW_ADMIN_EMAIL: sysadmin@sample.mattermost.com
      PW_ENSURE_PLUGINS_INSTALLED: ""
      PW_HA_CLUSTER_ENABLED: "false"
      PW_RESET_BEFORE_TEST: "false"
      PW_HEADLESS: "true"
      PW_SLOWMO: 0
      PW_WORKERS: 2
      PW_SNAPSHOT_ENABLE: "false"
      PW_PERCY_ENABLE: "false"
    ulimits:
      nofile:
        soft: 8096
        hard: 1048576
    working_dir: /mattermost
    volumes:
      - "../../:/mattermost"'

# File to be used for overriding docker compose
DC_FILE="server.override.yml"

# If the TEST type requires other services, also enable them
case $TEST in
cypress)
  enable_docker_service cypress
  enable_docker_service webhook-interactions
  ;;
playwright)
  enable_docker_service playwright
  ;;
esac

mme2e_log "Generating $DC_FILE using the following parameters:"
mme2e_log "TEST: ${TEST}"
mme2e_log "SERVER: ${SERVER}"
mme2e_log "ENABLED_DOCKER_SERVICES: ${ENABLED_DOCKER_SERVICES}"
assert_services_validity "$ENABLED_DOCKER_SERVICES"
ensure_optional_files_exist

# Generate the docker compose override file
cat <<EOL >"$DC_FILE"
# Image hashes in this file are for amd64 systems
# NB:  May include paths relative to the "server/build" directory, which contains the original compose file that this yaml is overriding

version: "2.4"
services:
  server:
    image: \${SERVER_IMAGE}
    restart: always
    env_file:
      - "./.env.server"
      - "./.env.server.cloud"
    environment:
      MM_SERVICESETTINGS_SITEURL: http://server:8065
      MM_SERVICESETTINGS_ENABLELOCALMODE: "true"
      MM_PLUGINSETTINGS_ENABLED: "true"
      MM_PLUGINSETTINGS_ENABLEUPLOADS: "true"
      MM_PLUGINSETTINGS_AUTOMATICPREPACKAGEDPLUGINS: "true"
      MM_TEAMSETTINGS_ENABLEOPENSERVER: "true"
      MM_SQLSETTINGS_DATASOURCE: "postgres://mmuser:mostest@postgres:5432/mattermost_test?sslmode=disable&connect_timeout=10&binary_parameters=yes"
      MM_SQLSETTINGS_DRIVERNAME: "postgres"
      MM_EMAILSETTINGS_SMTPSERVER: "inbucket"
      MM_CLUSTERSETTINGS_READONLYCONFIG: "false"
      MM_SERVICESETTINGS_ENABLEONBOARDINGFLOW: "false"
      MM_FEATUREFLAGS_ONBOARDINGTOURTIPS: "false"
      MM_SERVICEENVIRONMENT: "test"
    ports:
      - "8065:8065"
    depends_on:
$(for service in $ENABLED_DOCKER_SERVICES; do
  # The server container will start only if all other dependent services are healthy
  # Skip creating the dependency for containers that don't have or need a healthcheck
  if grep -qE "^(cypress|webhook-interactions|playwright)" <<<"$service"; then
    continue
  fi
  echo "      $service:"
  echo "        condition: service_healthy"
done)

$(for service in $ENABLED_DOCKER_SERVICES; do
  # Print all dependent services' docker-compose text blocks
  echo_docker_compose_textblock_for_service "$service"
done)

networks:
  default:
    name: \${COMPOSE_PROJECT_NAME}
    external: true
EOL

mme2e_log "Configuration generated in $DC_FILE"
