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
# Mattermost image when MATTERMOST_PILOT_IMAGE is unset; keep in sync with docker-compose.yml.
MM_IMAGE_DEFAULT='mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7'
MM_IMAGE_MAIN='mattermostdevelopment/mattermost-enterprise-edition:2d6c285_fc5e259@sha256:ed4bcaa423e09ddc8ddb229bc55c82178d7403299ce800d4a2b0ed79cf8b105c'
MAIN_TARGET_FILE="$INFRA_DIR/../v2/targets/main.json"
FORWARDER_PID="$RUN_DIR/forwarder.pid"
FORWARDER_LOG="$RUN_DIR/forwarder.log"
SEED_MANIFEST="$RUN_DIR/seed-manifest.json"
CANARY_NET=explorer-pilot-canary-net
CANARY=explorer-pilot-canary

# Checks the variable is exported (visible to child processes such as docker compose) without reading it out.
license_present() { node -e 'process.exit(process.env.MM_LICENSE ? 0 : 1)'; }

# apply_target <default|main>: selects the Mattermost image for the compose project (default leaves it unset).
apply_target() {
    case "$1" in
    default) unset MATTERMOST_PILOT_IMAGE ;;
    main)
        export MATTERMOST_PILOT_IMAGE="$MM_IMAGE_MAIN"
        main_target_file_matches || { echo "v2/targets/main.json image does not match the main pin in lib.sh" >&2; return 1; }
        ;;
    *) echo "unknown target: $1 (expected default or main)" >&2; return 2 ;;
    esac
}

# A present targets/main.json must name the same pinned image as MM_IMAGE_MAIN.
main_target_file_matches() {
    [ -f "$MAIN_TARGET_FILE" ] || return 0
    node -e '
        const t = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
        process.exit(`${t.image?.ref}@${t.image?.digest}` === process.argv[2] ? 0 : 1);
    ' "$MAIN_TARGET_FILE" "$MM_IMAGE_MAIN"
}

# Both images must already be pulled and carry the digest they are pinned to (the scripts never pull).
image_has_pinned_digest() {
    local ref=$1
    [[ "$ref" == *@sha256:* ]] || return 1
    docker image inspect --format '{{json .RepoDigests}}' "$ref" 2>/dev/null | grep -qF "@${ref##*@}\""
}

verify_images() {
    local ref
    for ref in "${MATTERMOST_PILOT_IMAGE:-$MM_IMAGE_DEFAULT}" "$PG_IMAGE"; do
        image_has_pinned_digest "$ref" || {
            echo "a required image is missing locally or its digest differs from the pin (images are never pulled by these scripts)" >&2
            return 1
        }
    done
}

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
