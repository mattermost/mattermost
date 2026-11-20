# Shared helpers for explorer-pilot infra scripts. Source, do not execute.
# Never add `set -x` here or in callers: the compose environment inherits MM_LICENSE.

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$INFRA_DIR/scripts"
RUN_DIR="$INFRA_DIR/.run"
COMPOSE=(docker compose -f "$INFRA_DIR/docker-compose.yml")

PILOT_PORT="${PILOT_PORT:-8065}"
BASE_URL="http://127.0.0.1:${PILOT_PORT}"
MM_CONTAINER=explorer-pilot-mattermost
PG_CONTAINER=explorer-pilot-postgres
PILOT_NETWORK=explorer-pilot_pilot_internal
PG_IMAGE='postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5'
FORWARDER_PID="$RUN_DIR/forwarder.pid"
FORWARDER_LOG="$RUN_DIR/forwarder.log"
SEED_MANIFEST="$RUN_DIR/seed-manifest.json"
CANARY_NET=explorer-pilot-canary-net
CANARY=explorer-pilot-canary

# Checks the variable is exported (visible to child processes such as docker compose) without reading it out.
license_present() { node -e 'process.exit(process.env.MM_LICENSE ? 0 : 1)'; }

container_ip() {
    docker inspect --format "{{ (index .NetworkSettings.Networks \"$PILOT_NETWORK\").IPAddress }}" "$1" 2>/dev/null
}

# wait_until <timeout_seconds> <command...>
wait_until() {
    local deadline=$((SECONDS + $1))
    shift
    until "$@" >/dev/null 2>&1; do
        [ "$SECONDS" -ge "$deadline" ] && return 1
        sleep 2
    done
}

pg_healthy() { [ "$(docker inspect --format '{{.State.Health.Status}}' "$PG_CONTAINER" 2>/dev/null)" = healthy ]; }

mm_ready_direct() {
    local ip
    ip="$(container_ip "$MM_CONTAINER")" && [ -n "$ip" ] && node "$SCRIPTS_DIR/probe.mjs" ready "http://$ip:8065"
}

forwarder_running() { [ -f "$FORWARDER_PID" ] && kill -0 "$(cat "$FORWARDER_PID")" 2>/dev/null; }

start_forwarder() {
    mkdir -p "$RUN_DIR"
    if forwarder_running; then
        return 0
    fi
    PILOT_PORT="$PILOT_PORT" nohup node "$INFRA_DIR/forwarder.mjs" >"$FORWARDER_LOG" 2>&1 &
    echo $! >"$FORWARDER_PID"
    wait_until 15 node "$SCRIPTS_DIR/probe.mjs" ready "$BASE_URL"
}

stop_forwarder() {
    if forwarder_running; then
        local pid
        pid="$(cat "$FORWARDER_PID")"
        kill -TERM "$pid" 2>/dev/null || true
        for _ in 1 2 3 4 5; do
            kill -0 "$pid" 2>/dev/null || break
            sleep 1
        done
    fi
    rm -f "$FORWARDER_PID"
}

# Brings up postgres + mattermost (no pulls) and waits until Mattermost answers ping on its container IP.
stack_up() {
    "${COMPOSE[@]}" up -d --pull never --quiet-pull >/dev/null 2>&1 || return 1
    wait_until 120 pg_healthy || return 1
    wait_until 240 mm_ready_direct || return 1
}

canary_down() {
    docker rm -f -v "$CANARY" >/dev/null 2>&1 || true
    docker network rm "$CANARY_NET" >/dev/null 2>&1 || true
}

stack_down() {
    stop_forwarder
    "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1
    rm -f "$SEED_MANIFEST"
}
