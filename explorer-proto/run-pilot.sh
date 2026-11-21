#!/usr/bin/env bash
# One-command entry point for the Channel Info explorer pilot. See explorer-proto/README.md.
#   run-pilot.sh [demo]              preflight, gate + seed, explore, emit, replay, guard-check, leak scan, teardown
#   run-pilot.sh verify [--repeat=N] two demo runs + determinism diff, N repeated replays (default 10, or PILOT_REPEAT),
#                                    replay-only negative controls, restore checks, absence probes, guard-check, guard-race
#   run-pilot.sh repeat [N]          replay the committed generated/ specs N times on the default seed (default 30)
#   run-pilot.sh down                teardown only
#   run-pilot.sh help
# Never add `set -x`: child processes inherit MM_LICENSE.
set -euo pipefail

PROTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$PROTO_DIR")"
INFRA_SCRIPTS="$PROTO_DIR/infra/scripts"
MANIFEST="$PROTO_DIR/infra/.run/seed-manifest.json"
SCENARIOS="$PROTO_DIR/scenarios.json"
WORK_DIR="$PROTO_DIR/infra/.run/pilot"
LOG_DIR="$WORK_DIR/logs"
REPORTS_DIR="$PROTO_DIR/generated/reports"
RESULTS_DIR="$PROTO_DIR/generated/test-results"
COMMITTED_SPECS="$PROTO_DIR/generated"
STORAGE_STATE_DIR="$REPO_ROOT/e2e-tests/playwright/storage_state"
LEAK_SCAN=(node "$INFRA_SCRIPTS/leak_scan.mjs")
COMPOSE_FILE="$PROTO_DIR/infra/docker-compose.yml"

MM_IMAGE='mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7'
PG_IMAGE='postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5'
PLAYWRIGHT_VERSION=1.62.1
BROWSER_DIRS=(chromium_headless_shell-1234 chromium-1234)

T_GATE=900
T_UP=600
T_EXPLORE=1500
T_EMIT=300
T_REPLAY=900
T_PER_REPEAT=150
T_DOWN=300

cd "$REPO_ROOT"

RESULTS=()
VERDICT_NAME=PILOT
CONTROL_LOGS=()
PILOT_LOGIN=""
CLI_RC=0
LAST_RC=0

banner() { printf '\n==== %s ====\n' "$*"; }
record() { RESULTS+=("$(printf '%-4s  %s' "$1" "$2")"); }

any_failed() {
    local line
    for line in ${RESULTS[@]+"${RESULTS[@]}"}; do
        [[ "$line" == FAIL* ]] && return 0
    done
    return 1
}

# run_step <label> <function> [args...]: runs the step in a subshell with errexit active and records
# PASS/FAIL; the status is left in LAST_RC. It always returns 0 and must never be called from an
# `if`/`||`/`&&` context: bash would then ignore `set -e` inside the step subshell as well.
run_step() {
    local label=$1
    shift
    banner "$label"
    set +e
    (set -e; "$@")
    LAST_RC=$?
    set -e
    if [ "$LAST_RC" -eq 0 ]; then
        record PASS "$label"
    else
        record FAIL "$label (exit $LAST_RC)"
    fi
}

# Fatal variant: a failing step stops the run (cleanup, teardown and the table run in the EXIT trap).
must() {
    run_step "$@"
    [ "$LAST_RC" -eq 0 ] || exit 1
}

positive_int() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }

# pw_summary <log>: list-reporter test and total lines only (error bodies may carry ids and URLs).
pw_summary() { grep -E '^\s+(✓|✘|-)\s+[0-9]+ \[|^\s+[0-9]+ (passed|failed|skipped|flaky|interrupted|did not run)' "$1" || true; }

manifest_field() { node -e 'const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const v = process.argv[2].split(".").reduce((o, k) => o?.[k], m); process.stdout.write(String(v ?? ""))' "$MANIFEST" "$1"; }

# Kept in the parent shell for the exit-time storage-state cleanup (down.sh removes the manifest).
capture_login() {
    local login
    login="$(manifest_field user.username)"
    [[ "$login" =~ ^[a-z0-9._-]+$ ]] || { echo "seed manifest has no usable username" >&2; exit 1; }
    PILOT_LOGIN="$login"
}

# ---------- storage-state isolation (names are held in memory only and never printed) ----------

declare -A SS_BEFORE=()
SS_DIR_EXISTED=false

snapshot_storage_state() {
    SS_BEFORE=()
    SS_DIR_EXISTED=false
    [ -d "$STORAGE_STATE_DIR" ] || return 0
    SS_DIR_EXISTED=true
    local f
    while IFS= read -r -d '' f; do
        SS_BEFORE["${f##*/}"]=1
    done < <(find "$STORAGE_STATE_DIR" -mindepth 1 -maxdepth 1 -print0)
}

# Deletes only entries that did not exist at the start and carry the pilot login id; prints counts only.
cleanup_storage_state() {
    local created=0 deleted=0 kept_other=0 remaining_pre=0 left_pilot=0 f name
    if [ -d "$STORAGE_STATE_DIR" ]; then
        while IFS= read -r -d '' f; do
            name="${f##*/}"
            if [ -n "${SS_BEFORE[$name]+x}" ]; then
                remaining_pre=$((remaining_pre + 1))
                continue
            fi
            created=$((created + 1))
            if [ -n "$PILOT_LOGIN" ] && [ -f "$f" ] && [[ "$name" == [0-9]*_"${PILOT_LOGIN}"_*.json ]]; then
                if rm -f -- "$f"; then deleted=$((deleted + 1)); else left_pilot=$((left_pilot + 1)); fi
            else
                kept_other=$((kept_other + 1))
            fi
        done < <(find "$STORAGE_STATE_DIR" -mindepth 1 -maxdepth 1 -print0)
        if [ "$SS_DIR_EXISTED" = false ]; then
            rmdir "$STORAGE_STATE_DIR" 2>/dev/null || true
        fi
    fi
    echo "storage_state: created $created, deleted $deleted, remaining pre-existing $remaining_pre (of ${#SS_BEFORE[@]}), new non-pilot entries kept $kept_other"
    [ "$left_pilot" -eq 0 ]
}

# ---------- steps ----------

step_preflight() {
    echo "checkout: $(git rev-parse HEAD)"
    local platform
    platform="$(docker version --format '{{.Server.Os}}/{{.Server.Arch}}')"
    [ "$platform" = linux/amd64 ] || { echo "docker server is $platform, need linux/amd64"; return 1; }
    echo "docker server: linux/amd64"

    node -e 'process.exit(process.env.MM_LICENSE ? 0 : 1)' || { echo "MM_LICENSE: not exported"; return 1; }
    echo "MM_LICENSE: present (name check only)"
    [ -z "${PW_USE_TESTCONTAINERS:-}" ] || { echo "PW_USE_TESTCONTAINERS must be unset"; return 1; }

    local image
    for image in "$MM_IMAGE" "$PG_IMAGE"; do
        docker image inspect --format '{{.Id}}' "$image" >/dev/null 2>&1 || { echo "image missing: $image"; return 1; }
        echo "image present: $image"
    done

    node -e 'process.exit(process.features.typescript ? 0 : 1)' || { echo "node $(node --version) cannot strip TypeScript"; return 1; }
    echo "node: $(node --version)"

    local pw_pkg="$REPO_ROOT/e2e-tests/playwright/node_modules/@playwright/test/package.json" version
    [ -f "$pw_pkg" ] || { echo "e2e-tests/playwright/node_modules/@playwright/test missing"; return 1; }
    version="$(node -p "require(process.argv[1]).version" "$pw_pkg")"
    [ "$version" = "$PLAYWRIGHT_VERSION" ] || { echo "@playwright/test is $version, need $PLAYWRIGHT_VERSION"; return 1; }
    echo "@playwright/test: $version"

    # Same resolution as Playwright: PLAYWRIGHT_BROWSERS_PATH, else ~/.cache/ms-playwright. Never downloads.
    local browsers="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}" dir
    for dir in "${BROWSER_DIRS[@]}"; do
        [ -f "$browsers/$dir/INSTALLATION_COMPLETE" ] || { echo "browser $dir missing (setup failure; nothing is downloaded)"; return 1; }
    done
    [ -x "$browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell" ] ||
        { echo "chromium_headless_shell-1234 has no chrome-headless-shell binary"; return 1; }
    echo "browsers: chromium_headless_shell-1234 (launched: headless chromium, no channel), chromium-1234"

    local link="$PROTO_DIR/node_modules"
    if [ ! -e "$link" ] && [ ! -L "$link" ]; then
        ln -s ../e2e-tests/playwright/node_modules "$link"
        echo "created symlink explorer-proto/node_modules -> ../e2e-tests/playwright/node_modules"
    fi
    [ -L "$link" ] && [ "$(readlink "$link")" = ../e2e-tests/playwright/node_modules ] ||
        { echo "explorer-proto/node_modules is not the expected symlink"; return 1; }
    git check-ignore -q explorer-proto/node_modules || { echo "explorer-proto/node_modules is not git-ignored"; return 1; }
    git check-ignore -q explorer-proto/infra/.run/pilot || { echo "scratch dir is not git-ignored"; return 1; }
    echo "explorer-proto/node_modules: symlink ok (git-ignored)"
    echo "storage_state entries present at start: ${#SS_BEFORE[@]}"
}

# step_stack <variant>: isolation + license gate (stack kept), then seed the variant.
step_stack() {
    local variant=$1 gate_log="$LOG_DIR/gate-$1.log" rc=0
    timeout --kill-after=30 "$T_GATE" "$INFRA_SCRIPTS/gate.sh" --keep >"$gate_log" 2>&1 || rc=$?
    if grep -q "PASS IsLicensed === 'true'" "$gate_log"; then
        echo "IsLicensed === 'true': PASS"
    else
        echo "IsLicensed === 'true': FAIL (setup failure: unlicensed or unreachable server)"
        return 1
    fi
    if [ "$rc" -eq 0 ] && grep -q '^GATE: PASS' "$gate_log"; then
        echo "isolation + license gate: PASS"
    else
        echo "isolation + license gate: FAIL; failing checks:"
        grep -E '^\[[A-Z ]+\] FAIL' "$gate_log" | sed -E 's/[0-9]+(\.[0-9]+){3}(:[0-9]+)?/<addr>/g; s/:[0-9]{2,5}\b/:<port>/g' || true
        return 1
    fi
    rc=0
    timeout --kill-after=30 "$T_UP" "$INFRA_SCRIPTS/up.sh" "--variant=$variant" >"$LOG_DIR/up-$variant.log" 2>&1 || rc=$?
    [ "$rc" -eq 0 ] || { echo "up.sh --variant=$variant failed (exit $rc); see infra/.run/pilot/logs/up-$variant.log"; return 1; }
    grep -q '^ready: ' "$LOG_DIR/up-$variant.log" || { echo "up.sh did not report ready"; return 1; }
    echo "seeded variant: $variant"
}

# step_cli <name> <timeout> <out> <mode> [playwright args...]: runs the engine CLI, keeps its log and
# Playwright report, prints a short summary and leaves the CLI exit code in CLI_RC (callers decide).
step_cli() {
    local name=$1 limit=$2 out=$3 mode=$4 log="$LOG_DIR/$1.log"
    shift 4
    local args=("$mode" "--out=$out")
    [ "$#" -gt 0 ] && args+=(-- "$@")
    rm -f "$REPORTS_DIR/$mode.json"
    CLI_RC=0
    timeout --kill-after=30 "$limit" node explorer-proto/src/cli.ts "${args[@]}" >"$log" 2>&1 || CLI_RC=$?
    if [ -f "$REPORTS_DIR/$mode.json" ]; then
        cp "$REPORTS_DIR/$mode.json" "$WORK_DIR/reports/$name.json"
    fi
    if [ "$mode" = emit ]; then
        cat "$log"
    else
        pw_summary "$log"
    fi
    [ "$CLI_RC" -eq 0 ] || echo "$mode exited $CLI_RC; full output in infra/.run/pilot/logs/$name.log"
}

# step_mode <name> <out> <mode> <report file>: a CLI mode that must exit 0, then prints its report.
step_mode() {
    step_cli "$1" "$T_REPLAY" "$2" "$3"
    [ "$CLI_RC" -eq 0 ]
    cat "$2/$4"
}

step_explore_emit() {
    local out=$1 tag=$2
    rm -rf "$out"
    mkdir -p "$out"
    echo "-- explore"
    step_cli "explore-$tag" "$T_EXPLORE" "$out" explore
    [ "$CLI_RC" -eq 0 ]
    echo "-- emit"
    step_cli "emit-$tag" "$T_EMIT" "$out" emit
    [ "$CLI_RC" -eq 0 ]
    local n
    n="$(find "$out" -maxdepth 1 -name '*.spec.ts' | wc -l)"
    [ "$n" -eq 2 ] || { echo "expected 2 generated specs, found $n"; return 1; }
    (cd "$out" && ls ./*.spec.ts | sed 's#^\./#generated spec: #')
}

# step_replay <specs dir> <name> pass <runs> [repeat] | <specs dir> <name> control <control name>
# Replay only (no explore, no emit), judged strictly from the Playwright JSON report.
step_replay() {
    local dir=$1 name=$2 kind=$3 arg=$4 repeat=${5:-1}
    local limit=$((T_REPLAY + repeat * T_PER_REPEAT))
    if [ "$repeat" -gt 1 ]; then
        step_cli "$name" "$limit" "$dir" replay "--repeat-each=$repeat"
    else
        step_cli "$name" "$limit" "$dir" replay
    fi
    [ -f "$WORK_DIR/reports/$name.json" ] || { echo "no Playwright JSON report for $name"; return 1; }
    local judge_rc=0
    node --input-type=module -e "$JUDGE_JS" "$WORK_DIR/reports/$name.json" "$kind" "$arg" >"$LOG_DIR/$name.verdict" || judge_rc=$?
    cat "$LOG_DIR/$name.verdict"
    [ "$judge_rc" -eq 0 ]
    if [ "$kind" = pass ]; then
        [ "$CLI_RC" -eq 0 ]
    else
        [ "$CLI_RC" -ne 0 ]
    fi
}

# step_control_api <action>: seed/role change or restore through the admin API (built-ins + fetch only).
step_control_api() {
    node --input-type=module -e "$CONTROL_JS" "$1" "$MANIFEST" "$SCENARIOS"
}

step_verify_seed() {
    local log="$LOG_DIR/verify-seed-$1.log" rc=0 pass fail
    PW_BASE_URL="$(manifest_field base_url)" node "$INFRA_SCRIPTS/verify_seed.mjs" "--variant=$1" >"$log" 2>&1 || rc=$?
    pass="$(grep -c '\] PASS ' "$log" || true)"
    fail="$(grep -c '\] FAIL ' "$log" || true)"
    echo "seed read-back ($1): $pass PASS, $fail FAIL"
    grep '\] FAIL ' "$log" || true
    [ "$rc" -eq 0 ] && [ "$fail" -eq 0 ] && [ "$pass" -gt 0 ]
}

# scan <label> <command...>: leak_scan prints only PASS/FAIL and a count.
scan() {
    local label=$1 out
    shift
    out="$("$@" 2>/dev/null)" || true
    echo "leak scan: $label -> ${out:-FAIL (no result)}"
    [[ "$out" == PASS* ]]
}
scan_compose_logs() { docker compose -f "$COMPOSE_FILE" logs --no-color 2>&1 | "${LEAK_SCAN[@]}"; }
scan_cached_diff() { git diff --cached | "${LEAK_SCAN[@]}"; }
scan_proto_diff() { git diff HEAD -- explorer-proto | "${LEAK_SCAN[@]}"; }
scan_storage_names() {
    if [ -d "$STORAGE_STATE_DIR" ]; then
        ls -A "$STORAGE_STATE_DIR" | "${LEAK_SCAN[@]}"
    else
        : | "${LEAK_SCAN[@]}"
    fi
}

step_leak_scan() {
    local fails=0 paths=("$WORK_DIR" "$PROTO_DIR/infra/.run")
    [ -d "$REPORTS_DIR" ] && paths+=("$REPORTS_DIR")
    [ -d "$RESULTS_DIR" ] && paths+=("$RESULTS_DIR")
    scan "generated output, reports, test results, logs" "${LEAK_SCAN[@]}" "${paths[@]}" || fails=$((fails + 1))
    scan "committed generated/ and explorer-proto sources" "${LEAK_SCAN[@]}" "$PROTO_DIR/generated" "$PROTO_DIR/src" \
        "$PROTO_DIR/scenarios.json" "$PROTO_DIR/coverage.md" || fails=$((fails + 1))
    scan "explorer-proto/run-pilot.sh" "${LEAK_SCAN[@]}" "$PROTO_DIR/run-pilot.sh" || fails=$((fails + 1))
    scan "explorer-proto/README.md" "${LEAK_SCAN[@]}" "$PROTO_DIR/README.md" || fails=$((fails + 1))
    scan "storage_state directory listing (names only, stdin)" scan_storage_names || fails=$((fails + 1))
    scan "docker compose logs" scan_compose_logs || fails=$((fails + 1))
    scan "git diff --cached" scan_cached_diff || fails=$((fails + 1))
    scan "git diff HEAD -- explorer-proto" scan_proto_diff || fails=$((fails + 1))
    [ "$fails" -eq 0 ]
}

step_down() { timeout --kill-after=30 "$T_DOWN" "$INFRA_SCRIPTS/down.sh"; }

step_diff_runs() {
    local a=$1 b=$2 f
    for f in pilot_01_mx_05.spec.ts pilot_02_mx_21.spec.ts trace.md trace.json; do
        [ -f "$a/$f" ] && [ -f "$b/$f" ] || { echo "$f missing in one run"; return 1; }
    done
    diff -r -x 'guard-*.md' -x 'absence-probe-*.md' "$a" "$b"
    echo "diff -r run-1 run-2 (specs, trace.md, trace.json): byte-identical"
}

spec_md5() { (cd "$1" && md5sum ./*.spec.ts); }

step_md5_unchanged() {
    spec_md5 "$1" >"$WORK_DIR/md5-after.txt"
    cat "$WORK_DIR/md5-after.txt"
    cmp -s "$WORK_DIR/md5-before.txt" "$WORK_DIR/md5-after.txt"
    echo "md5 before == after (replay did not regenerate)"
}

# ---------- Node helpers (built-ins and fetch only; never print tokens or passwords) ----------

CONTROL_JS=$(
    cat <<'EOF'
import fs from 'node:fs';

const [action, manifestPath, scenariosPath] = process.argv.slice(1);
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const base = m.base_url;
const ADMIN = {
    username: process.env.PW_ADMIN_USERNAME || 'sysadmin',
    password: process.env.PW_ADMIN_PASSWORD || 'Sys@dmin-sample1',
};
const DECLARED = 'Release purpose bravo-91d2';
const CHANGED_PURPOSE = 'Release purpose changed by the verify control';
const say = (s) => process.stdout.write(`${s}\n`);
const headers = {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'};

async function login(loginId, password) {
    const res = await fetch(`${base}/api/v4/users/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({login_id: loginId, password}),
        signal: AbortSignal.timeout(15000),
    });
    const token = res.headers.get('token');
    if (!res.ok || !token) {
        throw new Error(`login as ${loginId} failed (HTTP ${res.status})`);
    }
    return token;
}

async function client(loginId, password) {
    const token = await login(loginId, password);
    return async (method, route, label, body) => {
        const res = await fetch(`${base}/api/v4${route}`, {
            method,
            headers: {...headers, Authorization: `Bearer ${token}`},
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
        });
        let json = null;
        try {
            json = await res.json();
        } catch {
            json = null;
        }
        if (!res.ok) {
            throw new Error(`${loginId}: ${method} ${label} failed (HTTP ${res.status})`);
        }
        return json;
    };
}

function channel(name) {
    const c = m.channels?.[name];
    if (!c?.id) {
        throw new Error(`seed manifest has no channel ${name}`);
    }
    return {...c, name};
}

const RP = channel('release-planning');
const VIEW_ORDER = [RP, channel('qa-sandbox')];

async function reView() {
    const user = await client(m.user.username, m.user.password);
    for (const c of VIEW_ORDER) {
        await user('POST', `/channels/members/${m.user.id}/view`, `view ${c.name}`, {channel_id: c.id});
    }
    for (const c of VIEW_ORDER) {
        const u = await user('GET', `/users/${m.user.id}/channels/${c.id}/unread`, `unread ${c.name}`);
        if (u?.msg_count !== 0 || u?.mention_count !== 0) {
            throw new Error(`${c.name} still unread for ${m.user.username}`);
        }
    }
    say(`${m.user.username} re-viewed ${VIEW_ORDER.map((c) => c.name).join(', ')}: msg_count 0, mention_count 0`);
}

async function setPurpose(purpose) {
    const admin = await client(ADMIN.username, ADMIN.password);
    const before = await admin('GET', `/channels/${RP.id}`, 'get release-planning');
    await admin('PUT', `/channels/${RP.id}/patch`, 'patch release-planning', {purpose});
    const after = await admin('GET', `/channels/${RP.id}`, 'get release-planning');
    const unchanged = ['name', 'display_name', 'header', 'type', 'delete_at'].every((k) => after[k] === before[k]);
    if (after.purpose !== purpose || !unchanged) {
        throw new Error('release-planning: purpose not applied, or another field changed');
    }
    say(`release-planning purpose set to "${purpose}" (name, display name, header, type, archive state unchanged)`);
}

function declaredPurpose() {
    const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8')).scenarios;
    const fixture = scenarios.find((s) => s.id === 'PILOT-01')?.fixture_setup;
    const declared = fixture?.channels?.find((c) => c.name === 'release-planning')?.purpose;
    if (declared !== DECLARED || RP.purpose !== declared) {
        throw new Error('release-planning purpose in scenarios.json and the seed manifest disagree');
    }
    return declared;
}

async function schemeRoles(asAdmin) {
    const admin = await client(ADMIN.username, ADMIN.password);
    const route = `/teams/${m.team.id}/members/${m.user.id}`;
    await admin('PUT', `${route}/schemeRoles`, `schemeRoles ${m.user.username}`, {scheme_admin: asAdmin, scheme_user: true});
    const member = await admin('GET', route, `team member ${m.user.username}`);
    const roles = String(member?.roles ?? '').split(' ').filter(Boolean);
    const ok = asAdmin
        ? member.scheme_admin === true && member.scheme_user === true && roles.includes('team_admin')
        : member.scheme_admin === false && member.scheme_user === true && roles.includes('team_user') && !roles.includes('team_admin');
    say(`${m.user.username} team member read back: scheme_admin=${member?.scheme_admin}, scheme_user=${member?.scheme_user}, roles "${roles.join(' ')}"`);
    if (!ok) {
        throw new Error(`${m.user.username} team roles are not ${asAdmin ? 'team admin' : 'regular member'} after the change`);
    }
}

async function main() {
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) {
        throw new Error('seed manifest base_url is not a loopback origin');
    }
    switch (action) {
        case 'purpose-change':
            if (CHANGED_PURPOSE.includes(DECLARED)) {
                throw new Error('changed purpose must not contain the declared string');
            }
            await setPurpose(CHANGED_PURPOSE);
            await reView();
            return;
        case 'purpose-restore':
            await setPurpose(declaredPurpose());
            await reView();
            return;
        case 'team-admin-on':
            await schemeRoles(true);
            return;
        case 'team-admin-off':
            await schemeRoles(false);
            return;
        default:
            throw new Error(`unknown control action ${action}`);
    }
}

try {
    await main();
} catch (e) {
    say(`control helper failed: ${e.message}`);
    process.exit(1);
}
EOF
)

# Strict judge over the Playwright JSON report. Prints spec code-frame text and the first message
# line only (URLs and channel ids masked); never message bodies.
JUDGE_JS=$(
    cat <<'EOF'
import fs from 'node:fs';

const [reportPath, kind, arg] = process.argv.slice(1);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const strip = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');
const mask = (s) => strip(s).replace(/https?:\/\/[^\s'"]+/g, '<url>').replace(/\bID: \w+/g, 'ID: <id>');
const say = (s) => process.stdout.write(`${s}\n`);

const runs = [];
const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
            runs.push({id: spec.title.slice(0, 8), test});
        }
    }
    for (const child of suite.suites ?? []) {
        walk(child);
    }
};
(report.suites ?? []).forEach(walk);

const problems = [];
if ((report.errors ?? []).length > 0) {
    problems.push(`report has ${report.errors.length} global error(s): ${mask(report.errors[0].message).split('\n')[0]}`);
}

function codeFrame(e) {
    const marked = strip(e.snippet).split('\n').find((l) => /^>\s*\d+\s*\|/.test(l));
    if (marked) {
        return marked.replace(/^>\s*\d+\s*\|/, '').trim();
    }
    const loc = e.location;
    if (loc?.file && fs.existsSync(loc.file)) {
        return (fs.readFileSync(loc.file, 'utf8').split('\n')[loc.line - 1] ?? '').trim();
    }
    return '';
}
const callText = (frame) => frame.replace(/^await\s+/, '').replace(/;\s*(\/\/.*)?$/, '');

function errorsOf(test) {
    const out = [];
    for (const r of test.results ?? []) {
        const list = r.errors?.length ? r.errors : r.error ? [r.error] : [];
        for (const e of list) {
            const message = strip(e.message);
            out.push({message, first: mask(message.split('\n')[0]), call: callText(codeFrame(e))});
        }
    }
    return out;
}

const passedRun = (t) => t.status === 'expected' && (t.results ?? []).length === 1 && t.results.every((r) => r.status === 'passed');

const FORBIDDEN = [
    [/Test timeout/i, 'test timeout'],
    [/Network guard violations/, 'network guard violation'],
    [/\b(beforeEach|afterEach|beforeAll|afterAll)\b/, 'hook error'],
    [/\bfixture\b/i, 'fixture error'],
    [/Target page, context or browser has been closed/, 'page closed'],
];

const CONTROLS = {
    'release-purpose-changed': {
        fails: 'PILOT-01',
        passes: 'PILOT-02',
        expected: [{
            call: "expect.soft(info).toContainText('Release purpose bravo-91d2')",
            head: 'expect(locator).toContainText(expected) failed',
            includes: ['Expected substring: "Release purpose bravo-91d2"'],
        }],
        mustPass: [
            ['URL', (c) => c.includes('toHaveURL')],
            ["region 'Info' visible", (c) => c === 'expect(info).toBeVisible()'],
            ["'Close Info' visible", (c) => c.includes("'Close Info'")],
        ],
    },
    'no-archive': {
        fails: 'PILOT-02',
        passes: 'PILOT-01',
        expected: [{
            call: "expect(info.getByText('This channel is archived.', {exact: true})).toBeVisible()",
            head: 'expect(locator).toBeVisible() failed',
            includes: ["getByText('This channel is archived.', { exact: true })"],
        }],
        mustPass: [],
    },
    'team-admin': {
        fails: 'PILOT-02',
        passes: 'PILOT-01',
        expected: [{
            call: "expect(info.getByRole('button', {name: 'Unarchive', exact: true})).toHaveCount(0)",
            head: 'expect(locator).toHaveCount(expected) failed',
            includes: ['Received: 1', "getByRole('button', { name: 'Unarchive', exact: true })"],
        }],
        mustPass: [],
    },
};

if (kind === 'pass') {
    const want = Number(arg);
    const ok = runs.filter((r) => passedRun(r.test)).length;
    const perScenario = ['PILOT-01', 'PILOT-02'].map((id) => `${id} ${runs.filter((r) => r.id === id && passedRun(r.test)).length}/${runs.filter((r) => r.id === id).length}`);
    say(`replay executions: ${ok}/${want} passed (${perScenario.join(', ')})`);
    if (runs.length !== want) {
        problems.push(`report has ${runs.length} test executions, expected ${want}`);
    }
    if (runs.filter((r) => r.id === 'PILOT-01').length !== want / 2) {
        problems.push('PILOT-01 / PILOT-02 executions are not balanced');
    }
    for (const r of runs.filter((x) => !passedRun(x.test))) {
        const e = errorsOf(r.test)[0];
        problems.push(`${r.id} ${r.test.status}/${r.test.results?.[0]?.status}: ${e ? `${e.call || '(no code frame)'}: ${e.first}` : 'no error recorded'}`);
    }
} else if (kind === 'control' && CONTROLS[arg]) {
    const c = CONTROLS[arg];
    say(`control ${arg}`);
    if (runs.length !== 2) {
        problems.push(`report has ${runs.length} test executions, expected 2`);
    }
    const failing = runs.filter((r) => r.id === c.fails);
    const other = runs.filter((r) => r.id === c.passes);
    if (other.length !== 1 || !passedRun(other[0].test)) {
        problems.push(`${c.passes} did not pass`);
    }
    say(`  other test ${c.passes}: ${other.length === 1 && passedRun(other[0].test) ? 'passed' : 'NOT passed'}`);
    if (failing.length !== 1) {
        problems.push(`${c.fails} ran ${failing.length} times`);
    } else {
        const t = failing[0].test;
        const statuses = (t.results ?? []).map((r) => r.status);
        say(`  failing test ${c.fails}: test status ${t.status}, result status ${statuses.join(',') || 'none'}`);
        if (t.status !== 'unexpected' || statuses.length !== 1 || statuses[0] !== 'failed') {
            problems.push(`${c.fails} did not fail cleanly (status ${t.status}, results ${statuses.join(',') || 'none'})`);
        }
        const errors = errorsOf(t);
        const hits = c.expected.map(() => 0);
        for (const e of errors) {
            say(`  failing expect call: ${e.call || '(no code frame)'}`);
            say(`    first message line: ${e.first}`);
            for (const [re, why] of FORBIDDEN) {
                if (re.test(e.message)) {
                    problems.push(`rejected: ${why} (${e.first})`);
                }
            }
            const i = c.expected.findIndex((d) => e.call === d.call && e.first.includes(d.head) && d.includes.every((s) => e.message.includes(s)));
            if (i < 0) {
                problems.push(`failure outside the expected assertion: ${e.call || '(no code frame)'}`);
            } else {
                hits[i]++;
                say(`    matched expected text: ${c.expected[i].includes.join(' | ')}`);
            }
        }
        c.expected.forEach((d, i) => {
            if (hits[i] !== 1) {
                problems.push(`expected assertion matched ${hits[i]} times (need 1): ${d.call}`);
            }
        });
        for (const [label, test] of c.mustPass) {
            const among = errors.some((e) => test(e.call));
            say(`  ${label} assertion among failures: ${among ? 'YES' : 'no'}`);
            if (among) {
                problems.push(`${label} assertion failed`);
            }
        }
    }
} else {
    problems.push(`unknown judge mode ${kind} ${arg ?? ''}`);
}

say(problems.length ? `verdict: FAIL (${problems.join('; ')})` : `verdict: PASS (${kind}${arg ? ` ${arg}` : ''})`);
process.exit(problems.length ? 1 : 0);
EOF
)

# ---------- exit: storage-state cleanup, teardown, table, verdict ----------

teardown() {
    banner "(h) teardown (infra/scripts/down.sh; images are kept)"
    local rc=0
    timeout --kill-after=30 "$T_DOWN" "$INFRA_SCRIPTS/down.sh" || rc=$?
    if [ "$rc" -eq 0 ]; then record PASS "(h) teardown"; else record FAIL "(h) teardown (exit $rc)"; fi
}

on_exit() {
    local rc=$? f
    trap - EXIT
    set +e
    banner "storage-state cleanup (e2e-tests/playwright/storage_state; counts only)"
    if cleanup_storage_state; then
        record PASS "storage-state cleanup (only new entries named for the pilot login deleted)"
    else
        record FAIL "storage-state cleanup"
    fi
    if scan "storage_state directory listing after cleanup (names only, stdin)" scan_storage_names; then
        record PASS "leak scan: storage_state listing after cleanup"
    else
        record FAIL "leak scan: storage_state listing after cleanup"
    fi
    teardown
    if [ "${#CONTROL_LOGS[@]}" -gt 0 ]; then
        banner "control details"
        for f in "${CONTROL_LOGS[@]}"; do
            [ -f "$LOG_DIR/$f.verdict" ] && cat "$LOG_DIR/$f.verdict"
        done
    fi
    banner "$VERDICT_NAME: PASS/FAIL table"
    for f in ${RESULTS[@]+"${RESULTS[@]}"}; do
        echo "$f"
    done
    if [ "$VERDICT_NAME" = VERIFY ]; then
        echo "NOTE  the negative controls verify the declared assertions against SEED/ROLE changes, not against product regressions"
    fi
    if [ "$rc" -eq 0 ] && ! any_failed; then
        echo "$VERDICT_NAME: PASS"
        exit 0
    fi
    echo "$VERDICT_NAME: FAIL"
    [ "$rc" -eq 0 ] && rc=1
    exit "$rc"
}

begin() {
    VERDICT_NAME=$1
    rm -rf "$WORK_DIR"
    mkdir -p "$LOG_DIR" "$WORK_DIR/reports"
    snapshot_storage_state
    trap on_exit EXIT
}

stack() {
    must "$1" step_stack "$2"
    capture_login
}

# ---------- commands ----------

# demo_once <tag>: full demo into $WORK_DIR/<tag>/out. Fatal on any failure.
demo_once() {
    local tag=$1 out="$WORK_DIR/$1/out"
    must "[$tag] (a) preflight" step_preflight
    stack "[$tag] (b) gate + seed default (IsLicensed)" default
    must "[$tag] (c) explore + emit -> infra/.run/pilot/$tag/out" step_explore_emit "$out" "$tag"
    must "[$tag] (d) replay generated specs (fresh contexts)" step_replay "$out" "replay-$tag" pass 2
    must "[$tag] (e) guard-check" step_mode "guard-check-$tag" "$out" guard-check guard-report.md
    record SKIP "[$tag] (f) probe-absence: not part of demo (runs in verify)"
    must "[$tag] (g) leak scan" step_leak_scan
}

control() {
    CONTROL_LOGS+=("replay-$1")
    run_step "(4) control $1 (replay only): $2" step_replay "$RUN2" "replay-$1" control "$1"
}

cmd_demo() {
    begin DEMO
    demo_once demo
}

cmd_verify() {
    local repeat=${PILOT_REPEAT:-10} a
    for a in "$@"; do
        case "$a" in
        --repeat=*) repeat=${a#--repeat=} ;;
        *) echo "unknown verify argument: $a" >&2; exit 2 ;;
        esac
    done
    positive_int "$repeat" || { echo "--repeat must be a positive integer" >&2; exit 2; }
    begin VERIFY
    local run1="$WORK_DIR/run-1/out"
    RUN2="$WORK_DIR/run-2/out"

    demo_once run-1
    must "[run-1] teardown before run-2" step_down
    demo_once run-2
    run_step "(2) determinism: run-1 vs run-2 specs, trace.md, trace.json byte-identical" step_diff_runs "$run1" "$RUN2"
    run_step "(3) repeated replay: ${repeat}x on the default seed, $((2 * repeat)) executions must pass" \
        step_replay "$RUN2" replay-repeat pass $((2 * repeat)) "$repeat"
    spec_md5 "$RUN2" >"$WORK_DIR/md5-before.txt"

    must "(4) release-purpose-changed: apply (purpose only) + re-view" step_control_api purpose-change
    control release-purpose-changed "PILOT-01 fails only at toContainText('Release purpose bravo-91d2'), PILOT-02 passes"
    must "(4) release-purpose-changed: restore declared purpose + re-view" step_control_api purpose-restore

    must "(4) team-admin: qa-user scheme_admin=true (read back)" step_control_api team-admin-on
    control team-admin "PILOT-02 fails only at Unarchive toHaveCount(0) with Received: 1, PILOT-01 passes"
    must "(4) team-admin: restore scheme_admin=false (read back team_user, not team_admin)" step_control_api team-admin-off

    run_step "(4) restore check: seed read-back after the API controls" step_verify_seed default
    run_step "(4) restore check: replay on the restored default state, both tests pass" \
        step_replay "$RUN2" replay-restore-check pass 2

    stack "(4) no-archive: gate + seed variant" no-archive
    control no-archive "PILOT-02 fails only at 'This channel is archived.', PILOT-01 passes"
    run_step "(f) probe-absence (no-archive)" step_mode probe-absence-no-archive "$RUN2" probe-absence absence-probe-no-archive.md

    stack "[default] gate + seed (restores the no-archive control)" default
    run_step "(f) probe-absence (default)" step_mode probe-absence-default "$RUN2" probe-absence absence-probe-default.md
    run_step "(4) restore check after re-seed: replay, both tests pass" step_replay "$RUN2" replay-reseed-check pass 2
    run_step "(e) guard-check (default)" step_mode guard-check-verify "$RUN2" guard-check guard-report.md
    run_step "guard-race (local stand-in, no stack)" step_mode guard-race "$RUN2" guard-race guard-race-report.md
    run_step "(4) spec md5 unchanged by controls and replays" step_md5_unchanged "$RUN2"
    run_step "(g) leak scan (verify artifacts)" step_leak_scan
}

cmd_repeat() {
    local repeat=${1:-30}
    positive_int "$repeat" || { echo "repeat count must be a positive integer" >&2; exit 2; }
    begin REPEAT
    must "(a) preflight" step_preflight
    stack "(b) gate + seed default (IsLicensed)" default
    spec_md5 "$COMMITTED_SPECS" >"$WORK_DIR/md5-before.txt"
    run_step "replay committed generated/ specs ${repeat}x, $((2 * repeat)) executions must pass" \
        step_replay "$COMMITTED_SPECS" replay-repeat pass $((2 * repeat)) "$repeat"
    run_step "spec md5 unchanged" step_md5_unchanged "$COMMITTED_SPECS"
    run_step "(g) leak scan" step_leak_scan
}

cmd_help() {
    sed -n '2,8p' "$PROTO_DIR/run-pilot.sh" | sed 's/^# \{0,1\}//'
}

command=${1:-demo}
[ "$#" -gt 0 ] && shift
case "$command" in
demo) cmd_demo ;;
verify) cmd_verify "$@" ;;
repeat) cmd_repeat "$@" ;;
down)
    teardown
    ! any_failed
    ;;
help | -h | --help) cmd_help ;;
*)
    cmd_help >&2
    exit 2
    ;;
esac
