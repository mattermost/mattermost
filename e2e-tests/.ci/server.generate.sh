#!/bin/bash
# SC2034: <variable> appears unused.
# https://www.shellcheck.net/wiki/SC2034
# shellcheck disable=SC2034
# Note: Variables are dynamically used depending on usage input (ENABLED_DOCKER_SERVICES)

set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

enable_docker_service() {
  local SERVICE_TO_ENABLE="$1"
  if ! mme2e_is_token_in_list "$SERVICE_TO_ENABLE" "$ENABLED_DOCKER_SERVICES"; then
    ENABLED_DOCKER_SERVICES="$ENABLED_DOCKER_SERVICES $SERVICE_TO_ENABLE"
  fi
}

assert_docker_services_validity() {
  local SERVICES_TO_CHECK="$*"
  local SERVICES_VALID="postgres minio inbucket openldap elasticsearch keycloak cypress webhook-interactions playwright"
  local SERVICES_REQUIRED="postgres inbucket"
  for SERVICE_NAME in $SERVICES_TO_CHECK; do
    if ! mme2e_is_token_in_list "$SERVICE_NAME" "$SERVICES_VALID"; then
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

generate_docker_compose_file() {
  # Generating the server docker-compose file
  local DC_FILE="server.yml"
  mme2e_log "Generating docker-compose file in: $DC_FILE"

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
    environment:
      MM_SERVICESETTINGS_ALLOWCORSFROM: "*"
      MM_SERVICESETTINGS_ENABLELOCALMODE: "true"
      MM_SERVICESETTINGS_ENABLESECURITYFIXALERT: "false"
      MM_PLUGINSETTINGS_ENABLED: "true"
      MM_PLUGINSETTINGS_ENABLEUPLOADS: "true"
      MM_PLUGINSETTINGS_AUTOMATICPREPACKAGEDPLUGINS: "true"
      MM_TEAMSETTINGS_ENABLEOPENSERVER: "true"
      MM_SQLSETTINGS_DATASOURCE: "postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10&binary_parameters=yes"
      MM_SQLSETTINGS_DRIVERNAME: "postgres"
      MM_EMAILSETTINGS_SMTPSERVER: "localhost"
      MM_CLUSTERSETTINGS_READONLYCONFIG: "false"
      MM_SERVICESETTINGS_ENABLEONBOARDINGFLOW: "false"
      MM_FEATUREFLAGS_ONBOARDINGTOURTIPS: "false"
      MM_SERVICEENVIRONMENT: "test"
      MM_FEATUREFLAGS_MOVETHREADSENABLED: "true"
      MM_LOGSETTINGS_ENABLEDIAGNOSTICS: "false"
    network_mode: host
    depends_on:
$(for service in $ENABLED_DOCKER_SERVICES; do
    # The server container will start only if all other dependent services are healthy
    # Skip creating the dependency for containers that don't need a healthcheck
    if grep -qE "^(cypress|webhook-interactions|playwright)" <<<"$service"; then
      continue
    fi
    echo "      $service:"
    echo "        condition: service_healthy"
  done)

$(if mme2e_is_token_in_list "postgres" "$ENABLED_DOCKER_SERVICES"; then
    echo '
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
    network_mode: host
    healthcheck:
      test: ["CMD", "pg_isready", "-h", "localhost"]
      interval: 10s
      timeout: 15s
      retries: 12'
  fi)

$(if mme2e_is_token_in_list "inbucket" "$ENABLED_DOCKER_SERVICES"; then
    echo '
  inbucket:
    restart: "no"
    network_mode: host
    extends:
        file: ../../server/build/gitlab-dc.common.yml
        service: inbucket'
  fi)

$(if mme2e_is_token_in_list "minio" "$ENABLED_DOCKER_SERVICES"; then
    echo '
  minio:
    restart: "no"
    network_mode: host
    extends:
      file: ../../server/build/gitlab-dc.common.yml
      service: minio'
  fi)

$(if mme2e_is_token_in_list "openldap" "$ENABLED_DOCKER_SERVICES"; then
    echo '
  openldap:
    restart: "no"
    network_mode: host
    extends:
        file: ../../server/build/gitlab-dc.common.yml
        service: openldap'
  fi)

$(if mme2e_is_token_in_list "elasticsearch" "$ENABLED_DOCKER_SERVICES"; then
    if [ "$MME2E_ARCHTYPE" = "arm64" ]; then
      echo '
  elasticsearch:
    image: mattermostdevelopment/mattermost-elasticsearch:7.17.10
    platform: linux/arm64/v8
    restart: "no"
    network_mode: host
    extends:
        file: ../../server/build/gitlab-dc.common.yml
        service: elasticsearch'
    else
      echo '
  elasticsearch:
    restart: "no"
    network_mode: host
    extends:
        file: ../../server/build/gitlab-dc.common.yml
        service: elasticsearch'
    fi
  fi)

$(if mme2e_is_token_in_list "keycloak" "$ENABLED_DOCKER_SERVICES"; then
    echo '
  keycloak:
    restart: "no"
    network_mode: host
    extends:
        file: ../../server/build/gitlab-dc.common.yml
        service: keycloak'
  fi)

$(if mme2e_is_token_in_list "cypress" "$ENABLED_DOCKER_SERVICES"; then
    echo '
  cypress:
    image: "cypress/browsers:node-18.16.1-chrome-114.0.5735.133-1-ff-114.0.2-edge-114.0.1823.51-1"
    ### Temporarily disabling this image, until both the amd64 and arm64 version are mirrored
    # image: "mattermostdevelopment/mirrored-cypress-browsers-public:node-18.16.1-chrome-114.0.5735.133-1-ff-114.0.2-edge-114.0.1823.51-1"
    entrypoint: ["/bin/bash", "-c"]
    command: ["until [ -f /var/run/mm_terminate ]; do sleep 5; done"]
    env_file:
      - "../../e2e-tests/.ci/.env.cypress"
    environment:
      CYPRESS_baseUrl: "http://localhost:8065"
      CYPRESS_dbConnection: "postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10"
      CYPRESS_smtpUrl: "http://localhost:9001"
      CYPRESS_webhookBaseUrl: "http://localhost:3000"
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
    network_mode: host
    volumes:
      - "../../e2e-tests/cypress/:/cypress"'
  fi)

$(if mme2e_is_token_in_list "webhook-interactions" "$ENABLED_DOCKER_SERVICES"; then
    # shellcheck disable=SC2016
    echo '
  webhook-interactions:
    image: mattermostdevelopment/mirrored-node:${NODE_VERSION_REQUIRED}
    command: sh -c "npm install --global --legacy-peer-deps && exec node webhook_serve.js"
    healthcheck:
      test: ["CMD", "curl", "-s", "-o/dev/null", "127.0.0.1:3000"]
      interval: 10s
      timeout: 15s
      retries: 12
    working_dir: /cypress
    network_mode: host
    restart: on-failure
    volumes:
      - "../../e2e-tests/cypress/:/cypress:ro"'
  fi)

$(if mme2e_is_token_in_list "playwright" "$ENABLED_DOCKER_SERVICES"; then
    echo '
  playwright:
    image: mcr.microsoft.com/playwright:v1.42.1-jammy
    entrypoint: ["/bin/bash", "-c"]
    command: ["until [ -f /var/run/mm_terminate ]; do sleep 5; done"]
    env_file:
      - "./.env.playwright"
    environment:
      CI: "true"
      NODE_OPTIONS: --no-experimental-fetch
      PW_BASE_URL: http://localhost:8065
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
    network_mode: host
    volumes:
      - "../../:/mattermost"'
  fi)
EOL

  mme2e_log "docker-compose file generated."
}

generate_env_files() {
  # Generate .env.server
  mme2e_log "Generating .env.server"
  truncate -s 0 .env.server

  # Setting SERVER-specific variables
  case "$SERVER" in
  cloud)
    echo "MM_NOTIFY_ADMIN_COOL_OFF_DAYS=0.00000001" >>.env.server
    echo 'MM_FEATUREFLAGS_ANNUALSUBSCRIPTION="true"' >>.env.server
    # Load .env.cloud into .env.server
    # We assume the file exist at this point. The actual check for that should be done before calling this function
    cat >>.env.server <.env.cloud
    ;;
  esac

  # Setting MM_ENV-injected variables
  # shellcheck disable=SC2086
  envarr=$(echo ${MM_ENV:-} | tr "," "\n")
  for env in $envarr; do
    echo "$env" >>.env.server
  done

  # Generating TEST-specific env files
  # Some are defaulted in .e2erc due to being needed to other scripts as well
  export CI_BASE_URL="${CI_BASE_URL:-http://localhost:8065}"
  export REPO=mattermost # Static, but declared here for making generate_test_cycle.js easier to run
  export HEADLESS=true   # Static, but declared here for making generate_test_cycle.js easier to run
  case "$TEST" in
  cypress)
    mme2e_log "Cypress: Generating .env.cypress"
    truncate -s 0 .env.cypress

    mme2e_generate_envfile_from_var_names >.env.cypress <<-EOF
	BRANCH
	BUILD_ID
	CI_BASE_URL
	BROWSER
        HEADLESS
        REPO
        CYPRESS_pushNotificationServer
	EOF
    # Adding service-specific cypress variables
    for SERVICE in $ENABLED_DOCKER_SERVICES; do
      case $SERVICE in
      openldap)
        echo "CYPRESS_ldapServer=localhost" >>.env.cypress
        echo "CYPRESS_runLDAPSync=true" >>.env.cypress
        ;;
      minio)
        echo "CYPRESS_minioS3Endpoint=localhost:9000" >>.env.cypress
        ;;
      keycloak)
        echo "CYPRESS_keycloakBaseUrl=http://localhost:8484" >>.env.cypress
        ;;
      elasticsearch)
        echo "CYPRESS_elasticsearchConnectionURL=http://localhost:9200" >>.env.cypress
        ;;
      esac
    done
    # Adding SERVER-specific cypress variables
    case "$SERVER" in
    cloud)
      echo "CYPRESS_serverEdition=Cloud" >>.env.cypress
      ;;
    *)
      echo "CYPRESS_serverEdition=E20" >>.env.cypress
      ;;
    esac
    # Add Automation Dashboard related variables to cypress container
    if [ -n "${AUTOMATION_DASHBOARD_URL:-}" ]; then
      mme2e_log "Automation dashboard URL is set: loading related variables into the Cypress container"
      mme2e_generate_envfile_from_var_names >>.env.cypress <<-EOF
	AUTOMATION_DASHBOARD_URL
	AUTOMATION_DASHBOARD_TOKEN
	EOF
    elif DC_COMMAND="$MME2E_DC_DASHBOARD" mme2e_wait_service_healthy dashboard 1; then
      mme2e_log "Detected a running automation dashboard: loading its access variables into the Cypress container"
      cat >>.env.cypress <.env.dashboard
    fi
    ;;
  playwright)
    mme2e_log "Playwright: Generating .env.playwright"
    mme2e_generate_envfile_from_var_names >.env.playwright <<-EOF
	BRANCH
	BUILD_ID
	EOF
    ;;
  none)
    mme2e_log "Requested TEST=$TEST. Skipping generation of test-specific env files."
    ;;
  esac
}

# Perform SERVER-specific checks/customizations
case "$SERVER" in
cloud)
  if ! [ -f .env.cloud ]; then
    mme2e_log "Error: when using SERVER=$SERVER, the .env.cloud file is expected to exist, before generating the docker-compose file. Aborting." >&2
    exit 1
  fi
  ;;
esac

# Perform TEST-specific checks/customizations
case $TEST in
cypress)
  enable_docker_service cypress
  enable_docker_service webhook-interactions
  ;;
playwright)
  enable_docker_service playwright
  ;;
esac

mme2e_log "Generating docker-compose file using the following parameters..."
mme2e_log "TEST: ${TEST}"
mme2e_log "SERVER: ${SERVER}"
mme2e_log "ENABLED_DOCKER_SERVICES: ${ENABLED_DOCKER_SERVICES}"
assert_docker_services_validity "$ENABLED_DOCKER_SERVICES"
generate_docker_compose_file
generate_env_files
