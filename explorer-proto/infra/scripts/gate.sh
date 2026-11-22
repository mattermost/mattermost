#!/usr/bin/env bash
# Isolation + license gate for the explorer pilot.
#   gate.sh          run every check, then tear everything down
#   gate.sh --keep   run every check, leave stack + forwarder up (canary is always removed)
#   gate.sh --down   tear down only
#   --target=default|main|release-X.Y.Z (with run or --keep) selects the Mattermost image; the default is unchanged.
# Each line is DIRECT (tested here) or INFERRED (reasoned from DIRECT results). Exit 1 on any FAIL.
set -uo pipefail
source "$(dirname "$0")/lib.sh"

REPO_ROOT="$(cd "$INFRA_DIR/../.." && pwd)"
GATE_LOG="$RUN_DIR/gate-output.txt"
FAILURES=0

teardown() {
    canary_down
    stack_down
}

KEEP=false
DOWN_ONLY=false
for arg in "$@"; do
    case "$arg" in
    --down) DOWN_ONLY=true ;;
    --keep) KEEP=true ;;
    --target=*) apply_target "${arg#--target=}" || exit $? ;;
    esac
done
if [ "$DOWN_ONLY" = true ]; then
    teardown
    echo "teardown complete"
    exit 0
fi

mkdir -p "$RUN_DIR"
: >"$GATE_LOG"

# record <DIRECT|INFERRED> <PASS|FAIL> <description>
record() {
    local line
    line="$(printf '[%-8s] %-4s %s' "$1" "$2" "$3")"
    echo "$line" | tee -a "$GATE_LOG"
    [ "$2" = PASS ] || FAILURES=$((FAILURES + 1))
}

# check <DIRECT|INFERRED> <description> <command...>
check() {
    local kind=$1 desc=$2
    shift 2
    if "$@" >/dev/null 2>&1; then record "$kind" PASS "$desc"; else record "$kind" FAIL "$desc"; fi
}

finish() {
    echo "----"
    if [ "$FAILURES" -eq 0 ]; then
        echo "GATE: PASS" | tee -a "$GATE_LOG"
    else
        echo "GATE: FAIL ($FAILURES failing checks)" | tee -a "$GATE_LOG"
    fi
    canary_down
    if [ "$KEEP" = false ]; then
        stack_down
        echo "teardown complete (stack, forwarder, canary)"
    fi
    [ "$FAILURES" -eq 0 ]
    exit $?
}

echo "explorer-pilot isolation + license gate"
echo "----"

# Preconditions
if ! license_present; then
    record DIRECT FAIL "MM_LICENSE present in the invoking shell (name check only)"
    finish
fi
record DIRECT PASS "MM_LICENSE present in the invoking shell (name check only)"
check DIRECT "docker server is linux/amd64" \
    test "$(docker version --format '{{.Server.Os}}/{{.Server.Arch}}')" = linux/amd64

# a. Start the stack
teardown
if verify_images && stack_up; then
    record DIRECT PASS "stack up: postgres healthy and Mattermost /api/v4/system/ping OK (container IP, bounded wait)"
else
    record DIRECT FAIL "stack up: postgres healthy and Mattermost /api/v4/system/ping OK (container IP, bounded wait)"
    finish
fi

# b. Network membership and ports
networks_of() { docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$1" | xargs; }
only_internal() { [ "$(networks_of "$1")" = "$PILOT_NETWORK" ]; }
no_ports() { [ -z "$(docker port "$1")" ]; }
check DIRECT "$MM_CONTAINER attached only to $PILOT_NETWORK" only_internal "$MM_CONTAINER"
check DIRECT "$PG_CONTAINER attached only to $PILOT_NETWORK" only_internal "$PG_CONTAINER"
check DIRECT "$PILOT_NETWORK has Internal=true" \
    test "$(docker network inspect --format '{{.Internal}}' "$PILOT_NETWORK")" = true
check DIRECT "$MM_CONTAINER has no published ports (docker port empty)" no_ports "$MM_CONTAINER"
check DIRECT "$PG_CONTAINER has no published ports (docker port empty)" no_ports "$PG_CONTAINER"
no_default_route() {
    local routes
    routes="$(docker exec "$PG_CONTAINER" cat /proc/net/route)" || return 1
    [ "$(echo "$routes" | wc -l)" -ge 2 ] || return 1
    ! echo "$routes" | awk 'NR>1 {print $2}' | grep -qx 00000000
}
check DIRECT "$PG_CONTAINER has no default route (/proc/net/route)" no_default_route

# c. Mattermost -> PostgreSQL
MM_IP="$(container_ip "$MM_CONTAINER")"
check DIRECT "Mattermost reaches PostgreSQL: ping?get_server_status=true database_status OK" \
    node "$SCRIPTS_DIR/probe.mjs" db "http://$MM_IP:8065"

# d. Forwarder
if start_forwarder; then
    record DIRECT PASS "worker reaches Mattermost via forwarder $BASE_URL/api/v4/system/ping"
else
    record DIRECT FAIL "worker reaches Mattermost via forwarder $BASE_URL/api/v4/system/ping"
fi
check DIRECT "forwarder passes a WebSocket upgrade (/api/v4/websocket -> 101)" \
    node "$SCRIPTS_DIR/probe.mjs" ws 127.0.0.1 "$PILOT_PORT"
listen_loopback_only() {
    local addrs
    addrs="$(ss -Hltn "sport = :$PILOT_PORT" | awk '{print $4}' | sort -u | xargs)"
    [ "$addrs" = "127.0.0.1:$PILOT_PORT" ]
}
check DIRECT "forwarder socket bound only to 127.0.0.1:$PILOT_PORT (ss)" listen_loopback_only
refuses_public_bind() {
    local out
    out="$(PILOT_HOST=0.0.0.0 PILOT_PORT=$((PILOT_PORT + 1)) timeout 5 node "$INFRA_DIR/forwarder.mjs")" && return 1
    [[ "$out" == *"refusing to listen on non-loopback"* ]]
}
check DIRECT "forwarder refuses PILOT_HOST=0.0.0.0" refuses_public_bind

# e. Boundary canary (local only, same postgres image, no published ports)
canary_down
canary_ok=true
docker network create "$CANARY_NET" >/dev/null 2>&1 || canary_ok=false
if [ "$canary_ok" = true ]; then
    docker run -d --pull never --name "$CANARY" --network "$CANARY_NET" \
        -e POSTGRES_HOST_AUTH_METHOD=trust "$PG_IMAGE" >/dev/null 2>&1 || canary_ok=false
fi
canary_ready() { docker exec "$CANARY" pg_isready -h 127.0.0.1 -p 5432; }
[ "$canary_ok" = true ] && { wait_until 60 canary_ready || canary_ok=false; }
CANARY_IP=""
[ "$canary_ok" = true ] && CANARY_IP="$(docker inspect --format "{{ (index .NetworkSettings.Networks \"$CANARY_NET\").IPAddress }}" "$CANARY")"
[ -n "$CANARY_IP" ] || canary_ok=false
if [ "$canary_ok" = true ]; then
    record DIRECT PASS "canary $CANARY listening on $CANARY_NET ($CANARY_IP:5432)"
    check DIRECT "positive control: one-off container on $CANARY_NET reaches $CANARY_IP:5432" \
        docker run --rm --pull never --network "$CANARY_NET" --entrypoint bash "$PG_IMAGE" \
        -c "timeout 3 bash -c 'exec 3<>/dev/tcp/$CANARY_IP/5432'"
    # exec must itself work, so a missing container cannot pass as "unreachable".
    NEG_RC=skipped
    if docker exec "$PG_CONTAINER" bash -c true >/dev/null 2>&1; then
        docker exec "$PG_CONTAINER" bash -c "timeout 3 bash -c 'exec 3<>/dev/tcp/$CANARY_IP/5432'" >/dev/null 2>&1
        NEG_RC=$?
    fi
    if [ "$NEG_RC" != skipped ] && [ "$NEG_RC" -ne 0 ]; then
        record DIRECT PASS "negative test: $PG_CONTAINER (internal only) cannot reach $CANARY_IP:5432 (exit $NEG_RC)"
    else
        record DIRECT FAIL "negative test: $PG_CONTAINER (internal only) cannot reach $CANARY_IP:5432 (exit $NEG_RC)"
    fi
else
    record DIRECT FAIL "canary $CANARY listening on $CANARY_NET"
fi
canary_down
if only_internal "$MM_CONTAINER" && only_internal "$PG_CONTAINER"; then
    record INFERRED PASS "$MM_CONTAINER boundary: distroless (not exec'd); same sole internal network as the tested postgres container"
else
    record INFERRED FAIL "$MM_CONTAINER boundary: network membership differs from the tested postgres container"
fi

# f. License
if node "$SCRIPTS_DIR/probe.mjs" license "$BASE_URL"; then
    record DIRECT PASS "IsLicensed === 'true': PASS"
else
    record DIRECT FAIL "IsLicensed === 'true': FAIL (setup failure)"
fi
ENV_VALID_LINES="$("${COMPOSE[@]}" logs --no-color mattermost 2>/dev/null | grep -c 'License key from ENV is valid')"
if [ "${ENV_VALID_LINES:-0}" -ge 1 ]; then
    record DIRECT PASS "server log contains 'License key from ENV is valid' (count only: $ENV_VALID_LINES)"
else
    record DIRECT FAIL "server log contains 'License key from ENV is valid' (count only: 0)"
fi

# g. Leak scan (in-memory, PASS/FAIL only)
scan() {
    local desc=$1 out
    shift
    out="$("$@")"
    case "$out" in
    PASS*) record DIRECT PASS "leak scan: $desc -> $out" ;;
    *) record DIRECT FAIL "leak scan: $desc -> ${out:-no result}" ;;
    esac
}
scan_compose_logs() { "${COMPOSE[@]}" logs --no-color postgres mattermost 2>&1 | node "$SCRIPTS_DIR/leak_scan.mjs"; }
scan_dir() { node "$SCRIPTS_DIR/leak_scan.mjs" "$INFRA_DIR"; }
scan_compose_file() { node "$SCRIPTS_DIR/leak_scan.mjs" "$INFRA_DIR/docker-compose.yml"; }
scan_cached_diff() { git -C "$REPO_ROOT" diff --cached | node "$SCRIPTS_DIR/leak_scan.mjs"; }
scan_infra_diff() { git -C "$REPO_ROOT" diff HEAD -- explorer-proto/infra | node "$SCRIPTS_DIR/leak_scan.mjs"; }
scan "docker compose logs (postgres + mattermost)" scan_compose_logs
scan "compose file as written" scan_compose_file
scan "explorer-proto/infra/ incl. .run/ (forwarder log, gate output so far)" scan_dir
scan "git diff --cached" scan_cached_diff
scan "git diff HEAD -- explorer-proto/infra" scan_infra_diff

# h. Teardown happens in finish (skipped with --keep, except the canary)
finish
