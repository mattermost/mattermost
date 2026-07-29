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

# `docker compose up -d` returns non-zero the moment any depended container
# exits during startup, which masks openldap's own `restart: always` policy.
# On a small fraction of ubuntu-24.04 runners the osixia/openldap:1.4.0 image
# exits 1 on first boot (suspected init-script race under runner load). Retry
# the `up` a bounded number of times, force-recreating openldap between tries
# so its first-boot bootstrap re-runs cleanly, and dump rich diagnostics on
# every failure so future CI failures contain the actual data we need to
# permanently root-cause this. The diagnostics directory is also uploaded as
# a workflow artifact (see e2e-tests-*-template.yml `ci/upload-docker-diagnostics`).
DIAG_DIR="${PWD}/../docker-diagnostics"
mkdir -p "$DIAG_DIR"

dump_openldap_diagnostics() {
  local label="$1"
  local out="$DIAG_DIR/${label}"
  mkdir -p "$out"
  mme2e_log "[diagnostics:${label}] capturing openldap state to $out"

  # Container-level state (exit code, OOMKilled, error string, restart count)
  docker inspect mmserver-openldap-1 >"$out/openldap.inspect.json" 2>&1 || true
  ${MME2E_DC_SERVER} ps -a >"$out/compose.ps.txt" 2>&1 || true
  ${MME2E_DC_SERVER} logs --no-log-prefix -- openldap >"$out/openldap.log" 2>&1 || true

  # Merged compose config — confirms which security_opt / cap_add / image is actually applied
  ${MME2E_DC_SERVER} config >"$out/compose.config.yml" 2>&1 || true

  # Host-level state useful for OOM / AppArmor diagnosis
  uname -a >"$out/host.uname.txt" 2>&1 || true
  free -m >"$out/host.free.txt" 2>&1 || true
  df -h >"$out/host.df.txt" 2>&1 || true
  docker version >"$out/docker.version.txt" 2>&1 || true
  docker info >"$out/docker.info.txt" 2>&1 || true
  docker compose version >"$out/compose.version.txt" 2>&1 || true
  cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns >"$out/host.apparmor_userns.txt" 2>&1 || true
  # AppArmor denials and OOM kills land in dmesg — grep them out (needs sudo on GH runners).
  sudo dmesg | tail -200 >"$out/host.dmesg.tail.txt" 2>&1 || true
  sudo dmesg | grep -iE 'apparmor|denied|oom|killed|openldap|slapd' >"$out/host.dmesg.relevant.txt" 2>&1 || true

  # Echo the most useful slice straight to the workflow log so it shows up
  # in the GH Actions UI without needing to download the artifact.
  mme2e_log "----- openldap inspect (exit/oom/error) -----"
  docker inspect mmserver-openldap-1 \
    --format 'ExitCode={{.State.ExitCode}} OOMKilled={{.State.OOMKilled}} Error={{.State.Error}} Restarts={{.RestartCount}} Status={{.State.Status}}' \
    2>&1 || true
  mme2e_log "----- openldap log (last 100) -----"
  ${MME2E_DC_SERVER} logs --no-log-prefix --tail=100 -- openldap 2>&1 || true
  mme2e_log "----- relevant dmesg -----"
  sudo dmesg | grep -iE 'apparmor|denied|oom|killed|openldap|slapd' | tail -40 2>&1 || true
  mme2e_log "----- end diagnostics:${label} -----"
}

UP_ATTEMPTS=3
for attempt in $(seq 1 $UP_ATTEMPTS); do
  if ${MME2E_DC_SERVER} up -d --remove-orphans; then
    break
  fi
  dump_openldap_diagnostics "up-attempt-${attempt}"
  if [ "$attempt" -eq "$UP_ATTEMPTS" ]; then
    mme2e_log "compose up failed after ${UP_ATTEMPTS} attempts; aborting"
    exit 1
  fi
  # Force-recreate openldap so its first-boot init re-runs from a clean state
  ${MME2E_DC_SERVER} rm -fsv openldap || true
  sleep 5
done

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

# Wait for webhook-interactions container if running cypress or playwright tests
if [ "$TEST" = "cypress" ] || [ "$TEST" = "playwright" ]; then
  mme2e_log "Checking webhook-interactions container health"
  ${MME2E_DC_SERVER} logs --no-log-prefix -- webhook-interactions 2>&1 | tail -5
  if ! mme2e_wait_service_healthy webhook-interactions 2 10; then
    mme2e_log "Webhook interactions container not healthy, retry attempts exhausted. Giving up." >&2
    exit 1
  fi
  mme2e_log "Webhook interactions container is running and healthy"
fi
