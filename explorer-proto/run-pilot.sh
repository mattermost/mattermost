#!/usr/bin/env bash
# One-command entry point for the Channel Info explorer pilot. See explorer-proto/README.md.
#   run-pilot.sh [demo]   preflight, gate + seed, explore, emit, replay, guard-check, leak scan, teardown
#   run-pilot.sh verify   demo twice, determinism diff, replay-only negative controls, absence probes, guard-check
#   run-pilot.sh down     teardown only
#   run-pilot.sh help
# Never add `set -x`: child processes inherit MM_LICENSE.
set -euo pipefail

PROTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$PROTO_DIR")"
INFRA_SCRIPTS="$PROTO_DIR/infra/scripts"
WORK_DIR="$PROTO_DIR/infra/.run/pilot"
LOG_DIR="$WORK_DIR/logs"
REPORTS_DIR="$PROTO_DIR/generated/reports"
RESULTS_DIR="$PROTO_DIR/generated/test-results"
LEAK_SCAN=(node "$INFRA_SCRIPTS/leak_scan.mjs")
COMPOSE_FILE="$PROTO_DIR/infra/docker-compose.yml"

MM_IMAGE='mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7'
PG_IMAGE='postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5'
PLAYWRIGHT_VERSION=1.62.1
CHROMIUM_DIR=chromium-1234

T_GATE=900
T_UP=600
T_EXPLORE=1500
T_EMIT=300
T_REPLAY=900
T_DOWN=300

cd "$REPO_ROOT"

RESULTS=()
SUMMARY_PRINTED=false
SUMMARY_TITLE="pilot"

banner() { printf '\n==== %s ====\n' "$*"; }
record() { RESULTS+=("$(printf '%-4s  %s' "$1" "$2")"); }

print_summary() {
    [ "$SUMMARY_PRINTED" = true ] && return 0
    SUMMARY_PRINTED=true
    banner "$SUMMARY_TITLE: PASS/FAIL"
    local line
    for line in ${RESULTS[@]+"${RESULTS[@]}"}; do
        echo "$line"
    done
}

overall() {
    local line
    for line in ${RESULTS[@]+"${RESULTS[@]}"}; do
        [[ "$line" == FAIL* ]] && return 1
    done
    return 0
}

teardown() {
    banner "teardown (infra/scripts/down.sh; images are kept)"
    timeout --kill-after=30 "$T_DOWN" "$INFRA_SCRIPTS/down.sh" || echo "down.sh failed (exit $?)"
}

on_exit() {
    local rc=$?
    trap - EXIT
    print_summary
    teardown
    exit "$rc"
}

# run_step <label> <function> [args...]: runs the step with errexit active and records PASS/FAIL in LAST_RC.
# Always returns 0 and must never be called from an `if`/`||`/`&&` context: bash would then ignore
# `set -e` inside the step subshell as well.
LAST_RC=0
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

# Fatal variant: a failing step stops the run (summary + teardown happen in the EXIT trap).
must() {
    run_step "$@"
    [ "$LAST_RC" -eq 0 ] || exit 1
}

# pw_summary <log>: list-reporter test and total lines only (error bodies may carry ids and URLs).
pw_summary() { grep -E '^\s+(✓|✘|-)\s+[0-9]+ \[|^\s+[0-9]+ (passed|failed|skipped|flaky|did not run)' "$1" || true; }

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

    local browsers="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
    [ -d "$browsers/$CHROMIUM_DIR" ] || { echo "$CHROMIUM_DIR missing under the Playwright browsers path"; return 1; }
    echo "browser: $CHROMIUM_DIR"

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
}

# step_stack <variant>: isolation + license gate (stack kept), then seed the variant.
step_stack() {
    local variant=$1 gate_log="$LOG_DIR/gate-$1.log" rc=0
    timeout --kill-after=30 "$T_GATE" "$INFRA_SCRIPTS/gate.sh" --keep >"$gate_log" 2>&1 || rc=$?
    if grep -q "PASS IsLicensed === 'true'" "$gate_log"; then
        echo "IsLicensed === 'true': PASS"
    else
        echo "IsLicensed === 'true': FAIL (setup failure)"
        rc=1
    fi
    if grep -q '^GATE: PASS' "$gate_log" && [ "$rc" -eq 0 ]; then
        echo "isolation + license gate: PASS"
    else
        echo "isolation + license gate: FAIL; failing checks:"
        grep -E '^\[[A-Z ]+\] FAIL' "$gate_log" | sed -E 's/[0-9]+(\.[0-9]+){3}(:[0-9]+)?/<addr>/g; s/:[0-9]{2,5}\b/:<port>/g' || true
        return 1
    fi
    timeout --kill-after=30 "$T_UP" "$INFRA_SCRIPTS/up.sh" "--variant=$variant" >"$LOG_DIR/up-$variant.log" 2>&1 ||
        { echo "up.sh --variant=$variant failed; see infra/.run/pilot/logs/up-$variant.log"; return 1; }
    grep -q '^ready: ' "$LOG_DIR/up-$variant.log" || { echo "up.sh did not report ready"; return 1; }
    echo "seeded variant: $variant"
}

# step_cli <name> <timeout> <out> <cli args...>: runs the engine CLI, keeps its log and Playwright report.
step_cli() {
    local name=$1 limit=$2 out=$3 log="$LOG_DIR/$1.log" rc=0
    shift 3
    local mode=$1
    rm -f "$REPORTS_DIR/$mode.json"
    timeout --kill-after=30 "$limit" node explorer-proto/src/cli.ts "$@" "--out=$out" >"$log" 2>&1 || rc=$?
    if [ -f "$REPORTS_DIR/$mode.json" ]; then
        cp "$REPORTS_DIR/$mode.json" "$WORK_DIR/reports/$name.json"
    fi
    if [ "$mode" = emit ]; then
        cat "$log"
    else
        pw_summary "$log"
    fi
    [ "$rc" -eq 0 ] || { echo "$mode exited $rc; full output in infra/.run/pilot/logs/$name.log"; return 1; }
}

step_explore_emit() {
    local out=$1 tag=$2
    rm -rf "$out"
    mkdir -p "$out"
    echo "-- explore"
    step_cli "explore-$tag" "$T_EXPLORE" "$out" explore
    echo "-- emit"
    step_cli "emit-$tag" "$T_EMIT" "$out" emit
    local n
    n="$(find "$out" -maxdepth 1 -name '*.spec.ts' | wc -l)"
    [ "$n" -eq 2 ] || { echo "expected 2 generated specs, found $n"; return 1; }
    (cd "$out" && ls ./*.spec.ts | sed 's#^\./#generated spec: #')
}

# step_replay <out> <name> <expectation>: replay-only of already-generated specs, judged from the JSON report.
step_replay() {
    local out=$1 name=$2 expectation=$3 rc=0
    step_cli "$name" "$T_REPLAY" "$out" replay || rc=$?
    [ -f "$WORK_DIR/reports/$name.json" ] || { echo "no Playwright JSON report for $name"; return 1; }
    node --input-type=module -e "$JUDGE_JS" "$WORK_DIR/reports/$name.json" "$expectation" | tee "$LOG_DIR/$name.verdict"
    if [ "$expectation" = pass ]; then
        [ "$rc" -eq 0 ]
    fi
}

step_guard() { step_cli "guard-check-$2" "$T_REPLAY" "$1" guard-check && cat "$1/guard-report.md"; }

step_probe() { step_cli "probe-absence-$2" "$T_REPLAY" "$1" probe-absence && cat "$1/absence-probe-$2.md"; }

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

step_leak_scan() {
    local fails=0 paths=("$WORK_DIR" "$PROTO_DIR/infra/.run")
    [ -d "$REPORTS_DIR" ] && paths+=("$REPORTS_DIR")
    [ -d "$RESULTS_DIR" ] && paths+=("$RESULTS_DIR")
    scan "generated output, reports, test results, logs" "${LEAK_SCAN[@]}" "${paths[@]}" || fails=$((fails + 1))
    scan "committed generated/ and explorer-proto sources" "${LEAK_SCAN[@]}" "$PROTO_DIR/generated" "$PROTO_DIR/src" \
        "$PROTO_DIR/run-pilot.sh" "$PROTO_DIR/scenarios.json" "$PROTO_DIR/coverage.md" || fails=$((fails + 1))
    if [ -f "$PROTO_DIR/README.md" ]; then
        scan "explorer-proto/README.md" "${LEAK_SCAN[@]}" "$PROTO_DIR/README.md" || fails=$((fails + 1))
    fi
    scan "docker compose logs" scan_compose_logs || fails=$((fails + 1))
    scan "git diff --cached" scan_cached_diff || fails=$((fails + 1))
    scan "git diff HEAD -- explorer-proto" scan_proto_diff || fails=$((fails + 1))
    [ "$fails" -eq 0 ]
}

step_down() { timeout --kill-after=30 "$T_DOWN" "$INFRA_SCRIPTS/down.sh"; }

step_diff_specs() {
    local a=$1 b=$2
    diff -r -x '*.md' -x '*.json' "$a" "$b" && echo "diff -r (specs only): identical"
}

step_diff_trace() {
    local a=$1 b=$2 f
    for f in trace.json trace.md; do
        cmp -s "$a/$f" "$b/$f" || { echo "$f differs between runs"; return 1; }
    done
    echo "trace.json, trace.md: identical"
}

spec_md5() { (cd "$1" && md5sum ./*.spec.ts trace.json); }

step_md5_unchanged() {
    spec_md5 "$1" >"$WORK_DIR/md5-after.txt"
    cat "$WORK_DIR/md5-after.txt"
    cmp -s "$WORK_DIR/md5-before.txt" "$WORK_DIR/md5-after.txt" && echo "md5 before == after controls"
}

# ---------- Playwright JSON judge (no messages are printed, only spec source lines) ----------

JUDGE_JS=$(
    cat <<'EOF'
import fs from 'node:fs';
import path from 'node:path';

const [reportPath, expectation] = process.argv.slice(1);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const tests = [];
const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
        for (const t of spec.tests ?? []) {
            tests.push({title: spec.title, test: t});
        }
    }
    for (const child of suite.suites ?? []) {
        walk(child);
    }
};
(report.suites ?? []).forEach(walk);

const mask = (s) =>
    s.replace(/\u001b\[[0-9;]*m/g, '').replace(/https?:\/\/[^\s'"]+/g, '<url>').replace(/\d+ms/g, '<n>ms');
function failingLines(t) {
    const lines = new Map();
    for (const r of t.results ?? []) {
        const errors = r.errors?.length ? r.errors : r.error ? [r.error] : [];
        for (const e of errors) {
            const loc = e.location;
            if (loc?.file && fs.existsSync(loc.file)) {
                const src = fs.readFileSync(loc.file, 'utf8').split('\n')[loc.line - 1]?.trim() ?? '';
                lines.set(loc.line, `${path.basename(loc.file)}:${loc.line}: ${src}`);
            } else {
                lines.set(Number.MAX_SAFE_INTEGER - lines.size, `(no location) ${mask((e.message ?? '').split('\n')[0])}`);
            }
        }
    }
    return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

const byId = {};
for (const {title, test} of tests) {
    const id = title.slice(0, 8);
    const passed = test.status === 'expected';
    const lines = passed ? [] : failingLines(test);
    byId[id] = {passed, lines, status: test.status};
    console.log(`${id}: ${passed ? 'passed' : `failed (${test.status})`}`);
    for (const l of lines) {
        console.log(`    failing assertion: ${l}`);
    }
}

const problems = [];
const need = (id, cond, why) => {
    if (!byId[id]) problems.push(`${id} did not run`);
    else if (!cond(byId[id])) problems.push(why);
};
if (tests.length !== 2) problems.push(`expected 2 tests, report has ${tests.length}`);

const releaseRe = /^\s*await expect\.soft\(info\)\.toContainText\('Release (purpose|header) bravo-91d2'\)/;
const seedTextRe = /await expect\.soft\(info\)(\.not)?\.toContainText\('(Sandbox|Release) (purpose|header) (alpha-7f3c|bravo-91d2)'\)/;
const src = (l) => l.replace(/^[^:]+:\d+: /, '');

if (expectation === 'pass') {
    need('PILOT-01', (r) => r.passed, 'PILOT-01 did not pass');
    need('PILOT-02', (r) => r.passed, 'PILOT-02 did not pass');
} else if (expectation === 'swap-purpose-header') {
    need('PILOT-02', (r) => r.passed, 'PILOT-02 should pass under swap-purpose-header');
    need('PILOT-01', (r) => !r.passed, 'PILOT-01 did not fail');
    need('PILOT-01', (r) => r.lines.filter((l) => releaseRe.test(src(l))).length === 2,
        'PILOT-01 did not fail at both Release purpose/header assertions');
    need('PILOT-01', (r) => r.lines.every((l) => seedTextRe.test(src(l))),
        'PILOT-01 failed at an assertion other than the seed-bound purpose/header strings');
} else if (expectation === 'no-archive') {
    need('PILOT-01', (r) => r.passed, 'PILOT-01 should pass under no-archive');
    need('PILOT-02', (r) => !r.passed, 'PILOT-02 did not fail');
    need('PILOT-02', (r) => r.lines.length === 1 && src(r.lines[0]).includes("getByText('This channel is archived.'"),
        "PILOT-02 did not fail (only) at the 'This channel is archived.' assertion");
} else {
    problems.push(`unknown expectation ${expectation}`);
}

console.log(problems.length ? `verdict: FAIL (${problems.join('; ')})` : `verdict: PASS (${expectation})`);
process.exit(problems.length ? 1 : 0);
EOF
)

# ---------- commands ----------

# demo_once <tag>: full demo into $WORK_DIR/<tag>/out. Fatal on any failure.
demo_once() {
    local tag=$1 out="$WORK_DIR/$1/out"
    must "[$tag] (a) preflight" step_preflight
    must "[$tag] (b) gate + seed default (IsLicensed)" step_stack default
    must "[$tag] (c) explore + emit -> infra/.run/pilot/$tag/out" step_explore_emit "$out" "$tag"
    must "[$tag] (d) replay generated specs (fresh contexts)" step_replay "$out" "replay-$tag" pass
    must "[$tag] (e) guard-check" step_guard "$out" "$tag"
    must "[$tag] (g) leak scan" step_leak_scan
}

prepare_work_dir() {
    rm -rf "$WORK_DIR"
    mkdir -p "$LOG_DIR" "$WORK_DIR/reports"
}

cmd_demo() {
    SUMMARY_TITLE="demo checklist"
    prepare_work_dir
    trap on_exit EXIT
    demo_once demo
    print_summary
    overall
}

cmd_verify() {
    SUMMARY_TITLE="verify"
    prepare_work_dir
    trap on_exit EXIT
    local run1="$WORK_DIR/run-1/out" run2="$WORK_DIR/run-2/out"

    demo_once run-1
    must "[run-1] down" step_down
    demo_once run-2
    run_step "determinism: generated specs byte-identical (diff -r run-1 run-2)" step_diff_specs "$run1" "$run2"
    run_step "determinism: trace.json + trace.md byte-identical" step_diff_trace "$run1" "$run2"
    spec_md5 "$run2" >"$WORK_DIR/md5-before.txt"

    must "[control swap-purpose-header] gate + seed" step_stack swap-purpose-header
    run_step "control swap-purpose-header (replay only): PILOT-01 fails at Release strings, PILOT-02 passes" \
        step_replay "$run2" replay-swap-purpose-header swap-purpose-header

    must "[control no-archive] gate + seed" step_stack no-archive
    run_step "control no-archive (replay only): PILOT-02 fails at 'This channel is archived.', PILOT-01 passes" \
        step_replay "$run2" replay-no-archive no-archive
    run_step "probe-absence (no-archive)" step_probe "$run2" no-archive

    must "[default] gate + seed" step_stack default
    run_step "probe-absence (default)" step_probe "$run2" default
    run_step "guard-check (default)" step_guard "$run2" verify
    run_step "spec md5 unchanged by controls (replay did not regenerate)" step_md5_unchanged "$run2"
    run_step "leak scan (verify artifacts)" step_leak_scan

    print_summary
    local f
    for f in replay-swap-purpose-header replay-no-archive; do
        if [ -f "$LOG_DIR/$f.verdict" ]; then
            echo "--- ${f#replay-}"
            cat "$LOG_DIR/$f.verdict"
        fi
    done
    overall
}

cmd_help() {
    sed -n '2,6p' "$PROTO_DIR/run-pilot.sh" | sed 's/^# \{0,1\}//'
}

case "${1:-demo}" in
demo) cmd_demo ;;
verify) cmd_verify ;;
down) teardown ;;
help | -h | --help) cmd_help ;;
*)
    cmd_help >&2
    exit 2
    ;;
esac
