#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

# Wait for the required server image
mme2e_log "Waiting for server image to be available"
mme2e_wait_image "$SERVER_IMAGE" 4 30

# Launch mattermost-server, and wait for it to be healthy
mme2e_log "Starting E2E containers"
${MME2E_DC_SERVER} create
${MME2E_DC_SERVER} up -d --remove-orphans

# Postgres check
if ! mme2e_wait_command_success "${MME2E_DC_SERVER} exec -T -- postgres pg_isready -h localhost" "Waiting for postgres to accept connections" "30" "5"; then
  mme2e_log "Postgres not accepting connections"
  exit 1
fi

if ! mme2e_wait_service_healthy server 60 10; then
  mme2e_log "Mattermost container not healthy, retry attempts exhausted. Giving up." >&2
  exit 1
fi
# shellcheck disable=SC2043
for MIGRATION in migration_advanced_permissions_phase_2; do
  # Query explanation: if it doesn't find the migration in the table, there are 0 results and the command fails with a divide-by-zero error. Otherwise the command succeeds
  MIGRATION_CHECK_COMMAND="${MME2E_DC_SERVER} exec -T postgres sh -c 'PGPASSWORD=mostest psql -U mmuser mattermost_test -c \"select 1 / (select count(*) from Systems where name = '\''${MIGRATION}'\'' and value = '\''true'\'');\"'"
  if ! mme2e_wait_command_success "$MIGRATION_CHECK_COMMAND" "Waiting for migration to be completed: ${MIGRATION}" "10" "10"; then
    mme2e_log "Migration ${MIGRATION} not completed, retry attempts exhausted. Giving up." >&2

    LOG_DIR="../${TEST}/logs"
    mkdir -p "$LOG_DIR"

    # Save server logs to a file
    ${MME2E_DC_SERVER} logs --no-log-prefix -- server >"$LOG_DIR/server.log"
    mme2e_log "Server logs saved to server.log"

    # Save postgres logs to a file
    ${MME2E_DC_SERVER} logs --no-log-prefix -- postgres >"$LOG_DIR/postgres.log"
    mme2e_log "Postgres logs saved to postgres.log"

    exit 2
  fi
  mme2e_log "${MIGRATION}: completed."
done
mme2e_log "Mattermost container is running and healthy"
