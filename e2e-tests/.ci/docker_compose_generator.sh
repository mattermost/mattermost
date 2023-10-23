#!/bin/bash
# SC2034: <variable> appears unused.
# https://www.shellcheck.net/wiki/SC2034
# shellcheck disable=SC2034
# Note: Variables are dynamically used depending on usage input (ENABLED_DOCKER_SERVICES)

set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

# File to be used for overriding docker compose
CONFIG_FILE="docker-compose.server.override.yml"

# Check if ENABLED_DOCKER_SERVICES is set or not
if [ -n "${ENABLED_DOCKER_SERVICES-}" ] && [ -n "$ENABLED_DOCKER_SERVICES" ]; then
  mme2e_log "ENABLED_DOCKER_SERVICES: $ENABLED_DOCKER_SERVICES"
else
  # If not set, then remove the override file if it exists and exit
  mme2e_log "ENABLED_DOCKER_SERVICES is empty or unset."
  if [ -f $CONFIG_FILE ]; then
    rm -f $CONFIG_FILE
    mme2e_log "$CONFIG_FILE removed."
  else
    mme2e_log "No override to docker compose."
  fi
  exit 0
fi

# Define list of valid services
validServices=("postgres:5432" "minio:9000" "inbucket:9001" "openldap:389" "elasticsearch:9200" "keycloak:8080")

# Read the enabled docker services and split them into an array
enabled_docker_services="$ENABLED_DOCKER_SERVICES"
read -ra docker_services <<<"$enabled_docker_services"

# Initialize variables for required services
postgres_found=false
inbucket_found=false

# Get service and post of valid services
services=()
for service in "${docker_services[@]}"; do
  port=""
  for svcPort in "${validServices[@]}"; do
    svc=${svcPort%%:*}
    if [ "$service" == "$svc" ]; then
      port=${svcPort#*:}

      # Find the required services
      if [ "$service" == "$svc" ]; then
        if [ "$service" == "postgres" ]; then
          postgres_found=true
        elif [ "$service" == "inbucket" ]; then
          inbucket_found=true
        fi
      fi
      break
    fi
  done

  if [ -z "$port" ]; then
    mme2e_log "Unknown service $svc"
    exit 1
  fi

  services+=("$service:$port")
done

# Check if the required services such as postgres and inbucket are found
# Do not continue if any of the required services are not found.
if [ "$postgres_found" != true ] || [ "$inbucket_found" != true ]; then
  mme2e_log "When overriding docker compose via ENABLED_DOCKER_SERVICES, postgres and inbucket are both required."
  exit 1
fi

# Define each service values
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

# Function to get the service value based on the key
get_service_val_by_key() {
  local key="$1"

  if [ "$MME2E_ARCHTYPE" = "arm64" ] && [ "$key" = "elasticsearch" ]; then
    # Use arm64 version of elasticsearch
    key="elasticsearch_arm64"
  fi

  # Use variable indirection to retrieve the value
  local service_val="${!key}"

  echo "$service_val"
}

# Generate the docker compose override file
cat <<EOL >"$CONFIG_FILE"
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
      MM_LICENSE: \${MM_LICENSE}
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
$(for service in "${docker_services[@]}"; do
  echo "      $service:"
  echo "        condition: service_healthy"
done)
$(for service in "${docker_services[@]}"; do
  service_val=$(get_service_val_by_key "$service")

  if [ -n "$service_val" ]; then
    echo "$service_val"
  fi
done)

  start_dependencies:
    image: mattermost/mattermost-wait-for-dep:latest
    depends_on:
$(for service in "${docker_services[@]}"; do
  echo "      - $service"
done)
    command: $(
  IFS=' '
  echo "${services[*]}"
)
    networks:
      default:

networks:
  default:
    name: \${COMPOSE_PROJECT_NAME}
    external: true
EOL

mme2e_log "Configuration generated in $CONFIG_FILE"
