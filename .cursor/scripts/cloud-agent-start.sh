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

ensure_docker_socket_access() {
  if [ ! -S /var/run/docker.sock ]; then
    return 0
  fi

  sudo groupadd -f docker
  sudo usermod -aG docker "$(id -un)"
  sudo chgrp docker /var/run/docker.sock >/dev/null 2>&1 || true
  sudo chmod g+rw /var/run/docker.sock >/dev/null 2>&1 || true

  if command -v setfacl >/dev/null 2>&1; then
    sudo setfacl -m "u:$(id -un):rw" /var/run/docker.sock >/dev/null 2>&1 || true
  fi
}

docker_login_if_configured() {
  if [ -z "${DOCKERHUB_USERNAME:-}" ] || [ -z "${DOCKERHUB_TOKEN:-}" ]; then
    log "Docker Hub credentials not configured; anonymous pulls may hit rate limits."
    return 0
  fi

  log "Logging in to Docker Hub as ${DOCKERHUB_USERNAME}."
  if echo "${DOCKERHUB_TOKEN}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin >/tmp/docker-login.log 2>&1; then
    log "Docker Hub login succeeded."
  else
    log "Docker Hub login failed; see /tmp/docker-login.log."
    tail -n 20 /tmp/docker-login.log >&2 || true
  fi
}

if [ -f /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]; then
  sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0 >/dev/null 2>&1 || \
    log "Could not relax AppArmor user namespace restriction; openldap-based tests may need a larger host profile."
fi

ensure_docker_socket_access

if docker info >/dev/null 2>&1; then
  log "Docker is already running."
  docker compose version
  docker_login_if_configured
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
  ensure_docker_socket_access

  if docker info >/dev/null 2>&1; then
    log "Docker is ready."
    docker version
    docker compose version
    docker_login_if_configured
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
