#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[cloud-agent-start] %s\n' "$*" >&2
}

materialize_cloud_agent_instructions() {
  if [ -f .cursor/cursor.md ]; then
    cp .cursor/cursor.md .cursor/AGENTS.md
    log "Materialized Cloud Agent instructions at .cursor/AGENTS.md."
  fi
}

materialize_cloud_agent_instructions

if ! command -v docker >/dev/null 2>&1; then
  log "Docker CLI is missing. The Cloud Agent image did not build from .cursor/Dockerfile."
  exit 1
fi

if [ -f /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]; then
  sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0 >/dev/null 2>&1 || \
    log "Could not relax AppArmor user namespace restriction; openldap-based tests may need a larger host profile."
fi

if docker info >/dev/null 2>&1; then
  log "Docker is already running."
  docker compose version
  exit 0
fi

log "Starting Docker daemon."
if command -v service >/dev/null 2>&1; then
  sudo sh -c 'service docker start >/tmp/docker-service-start.log 2>&1' || \
    log "service docker start failed; falling back to direct dockerd startup."
fi

if ! pgrep -x dockerd >/dev/null 2>&1; then
  sudo sh -c 'nohup dockerd --host=unix:///var/run/docker.sock >/tmp/dockerd.log 2>&1 &'
fi

for _ in {1..60}; do
  if [ -S /var/run/docker.sock ]; then
    sudo chgrp docker /var/run/docker.sock >/dev/null 2>&1 || true
    sudo chmod g+rw /var/run/docker.sock >/dev/null 2>&1 || true
  fi

  if docker info >/dev/null 2>&1; then
    log "Docker is ready."
    docker version
    docker compose version
    exit 0
  fi

  sleep 1
done

log "Docker did not become ready within 60 seconds."
if [ -f /tmp/docker-service-start.log ]; then
  log "docker service output:"
  tail -n 80 /tmp/docker-service-start.log >&2 || true
fi
if [ -f /tmp/dockerd.log ]; then
  log "dockerd output:"
  tail -n 120 /tmp/dockerd.log >&2 || true
fi

exit 1
