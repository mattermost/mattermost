# shellcheck shell=bash
# Shared demo reset logic — source from start-dev.sh or reset-demo.sh.

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    printf 'Source reset-demo.lib.sh; do not execute directly.\n' >&2
    exit 1
fi

_demo_lib_dir="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
DEMO_SERVER_DIR="${DEMO_SERVER_DIR:-$(cd -- "$_demo_lib_dir/.." &>/dev/null && pwd)}"
DEMO_MMCTL="$DEMO_SERVER_DIR/bin/mmctl"
DEMO_SEED_PY="$_demo_lib_dir/seed-demo.py"

DEMO_SEED_JSONL=/tmp/demo-seed.jsonl
DEMO_SEED_ZIP=/tmp/demo-seed.zip
DEMO_SEED_INNER=/tmp/import.jsonl

DEMO_TEAM="demo"
DEMO_SAMPLE_TEAMS=("ad-1" "reiciendis-0")
DEMO_SAMPLE_USERS=(
    ashley.berry bobby.watson craig.reed diana.wagner gerald.gomez
    joe.cruz karen.austin keith.ryan kimberly.george lois.harper
    lori.carter robert.ward samuel.palmer sysadmin user-1 guest
)

demo_log()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
demo_ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
demo_warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
demo_die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

demo_mattermost_ping() {
    curl -fsS --max-time 3 http://localhost:8065/api/v4/system/ping >/dev/null 2>&1
}

# Starts the Go server in the background when :8065 is down. Requires MM_NO_DOCKER and
# RUN_SERVER_IN_BACKGROUND to be exported by the caller.
demo_ensure_mattermost_server() {
    if demo_mattermost_ping; then
        demo_ok "Mattermost server reachable on :8065"
        return 0
    fi

    demo_log "Starting Mattermost server (native Postgres, background)"
    if ! (cd "$DEMO_SERVER_DIR" && make run-server); then
        demo_die "Failed to start Mattermost server from $DEMO_SERVER_DIR"
    fi

    for _ in {1..120}; do
        if demo_mattermost_ping; then
            demo_ok "Mattermost server reachable on :8065"
            return 0
        fi
        sleep 1
    done
    demo_die "Mattermost server did not respond on http://localhost:8065 within 120s"
}

reset_demo_data() {
    demo_log "Preflight"

    [ -x "$DEMO_MMCTL" ] || demo_die "mmctl not found at $DEMO_MMCTL — run 'make mmctl-build' first"

    demo_ensure_mattermost_server

    if ! "$DEMO_MMCTL" --local system status >/dev/null 2>&1; then
        demo_die "mmctl --local cannot reach the server (check LocalModeSocketLocation in config.json)"
    fi
    demo_ok "mmctl --local works"

    local psql=""
    for candidate in /opt/homebrew/opt/postgresql@16/bin/psql /opt/homebrew/bin/psql /usr/local/bin/psql psql; do
        if command -v "$candidate" >/dev/null 2>&1; then
            psql="$candidate"
            break
        fi
    done
    [ -n "$psql" ] || demo_die "Could not find psql in PATH or /opt/homebrew/opt/postgresql@16/bin"

    local -a pgcmd=(env "PGPASSWORD=mostest" "$psql" -h localhost -U mmuser -d mattermost_test -v ON_ERROR_STOP=1 -X -A -t)
    if ! "${pgcmd[@]}" -c "SELECT 1" >/dev/null 2>&1; then
        demo_die "Cannot connect to Postgres as mmuser@localhost/mattermost_test — is brew services postgresql@16 running?"
    fi
    demo_ok "Postgres reachable as mmuser"

    [ -x "$DEMO_SEED_PY" ] || chmod +x "$DEMO_SEED_PY" 2>/dev/null || true

    demo_log "Verifying baseline state"

    if ! "$DEMO_MMCTL" --local team list 2>/dev/null | grep -qx "$DEMO_TEAM"; then
        demo_die "Team '$DEMO_TEAM' does not exist. Create it through the UI first."
    fi
    demo_ok "Team '$DEMO_TEAM' exists"

    if ! "$DEMO_MMCTL" --local user search yvette 2>/dev/null | grep -q "yvette"; then
        demo_die "User 'yvette' does not exist. Sign up through the UI first."
    fi
    demo_ok "User 'yvette' exists"

    demo_log "Sampledata"

    if "$DEMO_MMCTL" --local user search ashley.berry 2>/dev/null | grep -q "ashley.berry"; then
        demo_ok "Sampledata already imported (found ashley.berry)"
    else
        demo_warn "Running mmctl sampledata (~10s)…"
        "$DEMO_MMCTL" --local sampledata >/dev/null
        for _ in {1..30}; do
            sleep 1
            if "$DEMO_MMCTL" --local user search ashley.berry 2>/dev/null | grep -q "ashley.berry"; then
                demo_ok "Sampledata import finished"
                break
            fi
        done
    fi

    demo_log "Team memberships"

    local u
    for u in "${DEMO_SAMPLE_USERS[@]}"; do
        "$DEMO_MMCTL" --local team users add "$DEMO_TEAM" "$u" >/dev/null 2>&1 || true
    done
    demo_ok "All ${#DEMO_SAMPLE_USERS[@]} sample users are in the '$DEMO_TEAM' team"

    local t
    for t in "${DEMO_SAMPLE_TEAMS[@]}"; do
        if "$DEMO_MMCTL" --local team list 2>/dev/null | grep -qx "$t"; then
            "$DEMO_MMCTL" --local team users add "$t" yvette >/dev/null 2>&1 || true
            demo_ok "yvette is in '$t'"
        else
            demo_warn "Sample team '$t' not present, skipping yvette add"
        fi
    done

    demo_log "Clearing channel headers (demo + sample teams)"

    local cleared_headers
    cleared_headers=$("${pgcmd[@]}" -c "
WITH updated AS (
    UPDATE channels c
    SET header = '',
        updateat = (floor(extract(epoch FROM clock_timestamp()) * 1000))::bigint
    FROM teams t
    WHERE c.teamid = t.id
      AND t.name IN ('demo', 'ad-1', 'reiciendis-0')
      AND c.deleteat = 0
      AND length(trim(coalesce(c.header, ''))) > 0
    RETURNING c.id
)
SELECT count(*) FROM updated;
")
    cleared_headers=$(echo "$cleared_headers" | tr -d '[:space:]')
    if [ "${cleared_headers:-0}" -gt 0 ]; then
        demo_ok "Cleared header text on $cleared_headers channel(s)"
    else
        demo_ok "No channel headers to clear"
    fi

    demo_log "Cleaning up previously-seeded posts (props.demo_seed='v1')"

    local existing
    existing=$("${pgcmd[@]}" -c "SELECT count(*) FROM posts WHERE props->>'demo_seed' = 'v1'")
    existing=$(echo "$existing" | tr -d '[:space:]')

    if [ "${existing:-0}" -gt 0 ]; then
        "${pgcmd[@]}" <<'SQL'
DELETE FROM threadmemberships WHERE postid IN (SELECT id FROM posts WHERE props->>'demo_seed' = 'v1' AND rootid = '');
DELETE FROM threads WHERE postid IN (SELECT id FROM posts WHERE props->>'demo_seed' = 'v1' AND rootid = '');
DELETE FROM fileinfo WHERE postid IN (SELECT id FROM posts WHERE props->>'demo_seed' = 'v1');
DELETE FROM reactions WHERE postid IN (SELECT id FROM posts WHERE props->>'demo_seed' = 'v1');
DELETE FROM posts WHERE props->>'demo_seed' = 'v1';
SQL
        demo_ok "Removed $existing previously-seeded posts (+ thread metadata)"
    else
        demo_ok "No prior seeded posts found"
    fi

    demo_log "Generating seed JSONL"

    SEED_OUT="$DEMO_SEED_JSONL" python3 "$DEMO_SEED_PY"

    cp "$DEMO_SEED_JSONL" "$DEMO_SEED_INNER"
    rm -f "$DEMO_SEED_ZIP"
    ( cd /tmp && zip -j -q "$DEMO_SEED_ZIP" "$DEMO_SEED_INNER" )
    demo_ok "Wrote $DEMO_SEED_ZIP ($(du -h "$DEMO_SEED_ZIP" | awk '{print $1}'))"

    demo_log "Importing seed"

    local proc_out job_id status i
    proc_out=$("$DEMO_MMCTL" --local import process "$DEMO_SEED_ZIP" --bypass-upload 2>&1)
    echo "$proc_out" | sed 's/^/  /'
    job_id=$(echo "$proc_out" | grep -oE "ID: [a-z0-9]+" | head -1 | awk '{print $2}')
    [ -n "$job_id" ] || demo_die "Could not parse job id from mmctl output"

    for i in {1..60}; do
        status=$("$DEMO_MMCTL" --local import job show "$job_id" 2>/dev/null | grep -E "^\s*Status:" | awk '{print $2}')
        if [ "$status" = "success" ]; then
            demo_ok "Import job completed (${i}s)"
            break
        elif [ "$status" = "error" ]; then
            echo "  Job details:"
            "$DEMO_MMCTL" --local import job show "$job_id" 2>&1 | sed 's/^/    /'
            demo_die "Import job failed"
        fi
        sleep 1
    done

    demo_log "Summary"

    "${pgcmd[@]}" -P "format=aligned" <<'SQL' | sed 's/^/  /'
SELECT
    c.name                                                 AS channel,
    COUNT(*) FILTER (WHERE p.rootid = '')                  AS roots,
    COUNT(*) FILTER (WHERE p.rootid <> '')                 AS replies,
    COUNT(*) FILTER (WHERE p.message ILIKE '%@yvette%')    AS yvette_mentions
FROM posts p
JOIN channels c ON c.id = p.channelid
JOIN teams t    ON t.id = c.teamid
WHERE t.name = 'demo' AND p.props->>'demo_seed' = 'v1'
GROUP BY c.name
ORDER BY c.name;
SQL
}

print_demo_ready_message() {
    local webapp_url="${1:-http://localhost:9005}"
    cat <<EOF

Demo is prepped. To view it:
  1. Open $webapp_url (or http://localhost:8065 if only the server is running)
  2. Log in as 'yvette'
  3. Make sure the 'demo' team is selected (far-left team switcher)
  4. Hard-refresh the page (Cmd+Shift+R) to flush any cached client state
EOF
}
