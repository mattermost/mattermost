#!/usr/bin/env bash
# Repeatable end-to-end demo preparation for the local Mattermost dev instance.
#
# What it does:
#   1. Preflight: server up at :8065, mmctl in local mode, psql reachable
#   2. Imports sampledata (skipped if already imported)
#   3. Ensures all 16 sampledata users are members of the `demo` team
#   4. Ensures `yvette` is a member of the sample teams (`ad-1`, `reiciendis-0`)
#   5. Wipes previously-seeded demo posts (props.demo_seed = "v1")
#   6. Regenerates the seed JSONL via seed-demo.py
#   7. Bulk-imports the seed via `mmctl import process --bypass-upload`
#   8. Prints a summary of what landed where
#
# Assumes:
#   - Mattermost is running locally (see ../README or .cursor/cursor.md)
#   - The `yvette` user and the `demo` team already exist (created via signup)
#   - Native Homebrew Postgres is the backing DB (see psql detection below)
#
# Re-running is safe; the script is idempotent.

set -Eeuo pipefail

# ---- paths ------------------------------------------------------------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
SERVER_DIR="$(cd -- "$SCRIPT_DIR/.." &>/dev/null && pwd)"
MMCTL="$SERVER_DIR/bin/mmctl"
SEED_PY="$SCRIPT_DIR/seed-demo.py"

SEED_JSONL=/tmp/demo-seed.jsonl
SEED_ZIP=/tmp/demo-seed.zip
SEED_INNER=/tmp/import.jsonl    # mmctl import expects "import.jsonl" inside the zip

DEMO_TEAM="demo"
SAMPLE_TEAMS=("ad-1" "reiciendis-0")
SAMPLE_USERS=(
    ashley.berry bobby.watson craig.reed diana.wagner gerald.gomez
    joe.cruz karen.austin keith.ryan kimberly.george lois.harper
    lori.carter robert.ward samuel.palmer sysadmin user-1 guest
)

# ---- logging ----------------------------------------------------------------
log()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ---- preflight --------------------------------------------------------------
log "Preflight"

[ -x "$MMCTL" ] || die "mmctl not found at $MMCTL — run 'make mmctl-build' first"

if ! curl -fsS --max-time 3 http://localhost:8065/api/v4/system/ping >/dev/null; then
    die "Mattermost server is not responding on http://localhost:8065 — start it with 'MM_NO_DOCKER=true RUN_SERVER_IN_BACKGROUND=true make run' from server/"
fi
ok "Mattermost server reachable on :8065"

if ! "$MMCTL" --local system status >/dev/null 2>&1; then
    die "mmctl --local cannot reach the server (check LocalModeSocketLocation in config.json)"
fi
ok "mmctl --local works"

# Locate psql (Homebrew install puts it under /opt/homebrew/opt/postgresql@16/bin)
PSQL=""
for candidate in /opt/homebrew/opt/postgresql@16/bin/psql /opt/homebrew/bin/psql /usr/local/bin/psql psql; do
    if command -v "$candidate" >/dev/null 2>&1; then
        PSQL="$candidate"
        break
    fi
done
[ -n "$PSQL" ] || die "Could not find psql in PATH or /opt/homebrew/opt/postgresql@16/bin"

PGCMD=(env "PGPASSWORD=mostest" "$PSQL" -h localhost -U mmuser -d mattermost_test -v ON_ERROR_STOP=1 -X -A -t)
if ! "${PGCMD[@]}" -c "SELECT 1" >/dev/null 2>&1; then
    die "Cannot connect to Postgres as mmuser@localhost/mattermost_test — is brew services postgresql@16 running?"
fi
ok "Postgres reachable as mmuser"

[ -x "$SEED_PY" ] || chmod +x "$SEED_PY" 2>/dev/null || true

# ---- ensure demo team exists ------------------------------------------------
log "Verifying baseline state"

if ! "$MMCTL" --local team list 2>/dev/null | grep -qx "$DEMO_TEAM"; then
    die "Team '$DEMO_TEAM' does not exist. Create it through the UI first."
fi
ok "Team '$DEMO_TEAM' exists"

if ! "$MMCTL" --local user search yvette 2>/dev/null | grep -q "yvette"; then
    die "User 'yvette' does not exist. Sign up through the UI first."
fi
ok "User 'yvette' exists"

# ---- sampledata (idempotent) ------------------------------------------------
log "Sampledata"

if "$MMCTL" --local user search ashley.berry 2>/dev/null | grep -q "ashley.berry"; then
    ok "Sampledata already imported (found ashley.berry)"
else
    warn "Running mmctl sampledata (~10s)…"
    "$MMCTL" --local sampledata >/dev/null
    # Sampledata is async via an import job; poll briefly.
    for _ in {1..30}; do
        sleep 1
        if "$MMCTL" --local user search ashley.berry 2>/dev/null | grep -q "ashley.berry"; then
            ok "Sampledata import finished"
            break
        fi
    done
fi

# ---- team membership (idempotent) ------------------------------------------
log "Team memberships"

for u in "${SAMPLE_USERS[@]}"; do
    "$MMCTL" --local team users add "$DEMO_TEAM" "$u" >/dev/null 2>&1 || true
done
ok "All ${#SAMPLE_USERS[@]} sample users are in the '$DEMO_TEAM' team"

for t in "${SAMPLE_TEAMS[@]}"; do
    if "$MMCTL" --local team list 2>/dev/null | grep -qx "$t"; then
        "$MMCTL" --local team users add "$t" yvette >/dev/null 2>&1 || true
        ok "yvette is in '$t'"
    else
        warn "Sample team '$t' not present, skipping yvette add"
    fi
done

# ---- wipe prior seeded posts -----------------------------------------------
log "Cleaning up previously-seeded posts (props.demo_seed='v1')"

EXISTING=$("${PGCMD[@]}" -c "SELECT count(*) FROM posts WHERE props->>'demo_seed' = 'v1'")
EXISTING=$(echo "$EXISTING" | tr -d '[:space:]')

if [ "${EXISTING:-0}" -gt 0 ]; then
    "${PGCMD[@]}" <<'SQL'
DELETE FROM threadmemberships WHERE postid IN (SELECT id FROM posts WHERE props->>'demo_seed' = 'v1' AND rootid = '');
DELETE FROM threads WHERE postid IN (SELECT id FROM posts WHERE props->>'demo_seed' = 'v1' AND rootid = '');
DELETE FROM fileinfo WHERE postid IN (SELECT id FROM posts WHERE props->>'demo_seed' = 'v1');
DELETE FROM reactions WHERE postid IN (SELECT id FROM posts WHERE props->>'demo_seed' = 'v1');
DELETE FROM posts WHERE props->>'demo_seed' = 'v1';
SQL
    ok "Removed $EXISTING previously-seeded posts (+ thread metadata)"
else
    ok "No prior seeded posts found"
fi

# ---- generate seed JSONL ----------------------------------------------------
log "Generating seed JSONL"

SEED_OUT="$SEED_JSONL" python3 "$SEED_PY"

cp "$SEED_JSONL" "$SEED_INNER"
rm -f "$SEED_ZIP"
( cd /tmp && zip -j -q "$SEED_ZIP" "$SEED_INNER" )
ok "Wrote $SEED_ZIP ($(du -h "$SEED_ZIP" | awk '{print $1}'))"

# ---- import -----------------------------------------------------------------
log "Importing seed"

PROC_OUT=$("$MMCTL" --local import process "$SEED_ZIP" --bypass-upload 2>&1)
echo "$PROC_OUT" | sed 's/^/  /'
JOB_ID=$(echo "$PROC_OUT" | grep -oE "ID: [a-z0-9]+" | head -1 | awk '{print $2}')
[ -n "$JOB_ID" ] || die "Could not parse job id from mmctl output"

for i in {1..60}; do
    STATUS=$("$MMCTL" --local import job show "$JOB_ID" 2>/dev/null | grep -E "^\s*Status:" | awk '{print $2}')
    if [ "$STATUS" = "success" ]; then
        ok "Import job completed (${i}s)"
        break
    elif [ "$STATUS" = "error" ]; then
        echo "  Job details:"
        "$MMCTL" --local import job show "$JOB_ID" 2>&1 | sed 's/^/    /'
        die "Import job failed"
    fi
    sleep 1
done

# ---- summary ----------------------------------------------------------------
log "Summary"

"${PGCMD[@]}" -P "format=aligned" <<'SQL' | sed 's/^/  /'
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

cat <<EOF

Demo is prepped. To view it:
  1. Open http://localhost:8065 and log in as 'yvette'
  2. Make sure the 'demo' team is selected (far-left team switcher)
  3. Hard-refresh the page (Cmd+Shift+R) to flush any cached client state

Re-run this script any time you need to reset to a known demo state.
EOF
