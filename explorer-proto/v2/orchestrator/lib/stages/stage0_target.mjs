// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak, @stylistic/wrap-regex, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Stage 0, target: load and validate the target file, check its image pins against infra/scripts/lib.sh without Docker,
// and (only with --live) start the stack through the infra scripts and record the licence result as PASS or FAIL.
//
// A live stage 0 is a list of attempts. Each attempt writes its own files below attempt-<n>/ and is never touched
// again. A later invocation reuses the newest passing attempt, without running anything, when its recorded inputs are
// unchanged and a cheap live probe confirms the fixture; otherwise it starts a new attempt and records why.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {sha256File, PROTO_DIR, readJson, repoRel, REPO_ROOT, V2_DIR, ORCH_DIR} from '../common.mjs';
import {infraPaths, INFRA_SESSIONS} from '../infra.mjs';
import {validate} from '../schemas.mjs';
import {checkManifestSession, declaredBookmarks, loadCharter, probeFixture, readManifest} from '../verify/fixture.mjs';

const LIB_SH = path.join(PROTO_DIR, 'infra', 'scripts', 'lib.sh');
const UP_SH = 'explorer-proto/infra/scripts/up.sh';
const GATE_SH = 'explorer-proto/infra/scripts/gate.sh';
const DOWN_SH = 'explorer-proto/infra/scripts/down.sh';
const ATTEMPT_DIR = /^attempt-([1-9][0-9]*)$/;
const ATTEMPT_FILES = ['target.json', 'target-check.json', 'setup.json'];

const state = {started: false};

export function targetFile(kind) {
    const shared = path.join(V2_DIR, 'targets', `${kind}.json`);
    if (fs.existsSync(shared)) {
        return shared;
    }
    return path.join(ORCH_DIR, 'targets', `${kind}.json`);
}

/** infra's name for the target selector of up.sh and gate.sh. */
export function infraTarget(kind) {
    return kind === 'main' ? 'main' : 'default';
}

function pinFromLib(name) {
    const m = new RegExp(`^${name}='([^']+)'`, 'm').exec(fs.readFileSync(LIB_SH, 'utf8'));
    return m?.[1] ?? null;
}

export function imagePin(kind) {
    return pinFromLib(kind === 'main' ? 'MM_IMAGE_MAIN' : 'MM_IMAGE_DEFAULT');
}

function gitCommitOf(ref) {
    const r = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
    return r.status === 0 ? r.stdout.trim() : null;
}

function staticChecks(kind, target) {
    const checks = [
        {id: 'target_schema', result: 'pass', evidence: 'explorer-target/v2 schema accepted the target file'},
    ];
    const expected = imagePin(kind);
    const actual = `${target.image.ref}@${target.image.digest}`;
    checks.push({
        id: 'image_pin_matches_lib_sh',
        result: expected === actual ? 'pass' : 'fail',
        evidence: `target image reference ${expected === actual ? 'equals' : 'differs from'} the pin in infra/scripts/lib.sh`,
    });
    const database = pinFromLib('PG_IMAGE');
    if (target.database_image) {
        const same = `${target.database_image.ref}@${target.database_image.digest}` === database;
        checks.push({
            id: 'database_pin_matches_lib_sh',
            result: same ? 'pass' : 'fail',
            evidence: `database image reference ${same ? 'equals' : 'differs from'} PG_IMAGE in infra/scripts/lib.sh`,
        });
    }
    if (kind === 'release') {
        const commit = gitCommitOf(target.ref);
        let result = 'info';
        let evidence = `tag ${target.ref} is not present in this checkout, so the target sha was not verified`;
        if (commit) {
            result = commit === target.sha ? 'pass' : 'fail';
            evidence = `tag ${target.ref} ${commit === target.sha ? 'resolves to' : 'does not resolve to'} the target sha`;
        }
        checks.push({id: 'release_tag_sha', result, evidence});
    }
    checks.push({
        id: 'licence_recorded',
        result: target.licence_check === 'PASS' ? 'info' : 'fail',
        evidence: `target file records licence_check ${target.licence_check}; it is measured only in a live run`,
    });
    return checks;
}

function parseGate(stdout) {
    const licence = /IsLicensed[^\n]*\b(PASS|FAIL)\b/.exec(stdout)?.[1] ?? 'FAIL';
    const gate = /GATE:\s*(PASS|FAIL)/.exec(stdout)?.[1] ?? 'FAIL';
    return {licence, gate};
}

function attemptNumbers(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs
        .readdirSync(dir)
        .map((name) => ATTEMPT_DIR.exec(name)?.[1])
        .filter(Boolean)
        .map(Number)
        .sort((a, b) => a - b);
}

function readAttempts(dir) {
    return attemptNumbers(dir).map((n) => {
        const attempt = readJson(path.join(dir, `attempt-${n}`, 'attempt.json'));
        return {...attempt, dir: `attempt-${n}`};
    });
}

/** The newest attempt whose files still hash as recorded, or null. */
function newestIntactAttempt(dir) {
    const attempts = readAttempts(dir);
    const last = attempts.at(-1);
    if (!last) {
        return null;
    }
    const intact = Object.entries(last.files).every(([name, hash]) => {
        const file = path.join(dir, last.dir, name);
        return fs.existsSync(file) && sha256File(file) === hash;
    });
    return intact ? last : null;
}

function writeStatus(ctx, session) {
    const attempts = readAttempts(ctx.dir).map((a) => ({
        attempt: a.attempt,
        dir: a.dir,
        outcome: a.outcome,
        reason: a.reason,
        ...(a.detail ? {detail: a.detail} : {}),
        files: a.files,
    }));
    const passing = attempts.filter((a) => a.outcome === 'pass');
    ctx.writeJson(
        'status.json',
        {
            schema: 'explorer-stage0-status/v1',
            session,
            attempts,
            current_attempt: passing.length ? passing.at(-1).attempt : null,
        },
        'orch#stage0-status',
    );
}

function currentInputs(kind, session) {
    return {target_file_sha256: sha256File(targetFile(kind)), image_pin: imagePin(kind), session: session ?? null};
}

function dispatchReleasedStack(ctx) {
    const file = path.join(ctx.out, 'verify', 'dispatch.json');
    if (!ctx.flags.verifySpec || !fs.existsSync(file)) {
        return false;
    }
    try {
        return readJson(file).teardown?.confirmed === true;
    } catch {
        return false;
    }
}

/**
 * Decides, before the stage would run, whether a live invocation may reuse the stack of an earlier attempt. Runs only
 * reads: the recorded inputs are compared, then the fixture is probed through the seeding admin. Nothing under the stage
 * directory is touched when the answer is yes.
 */
async function liveReuse(ctx) {
    if (dispatchReleasedStack(ctx)) {
        return {reuse: true, note: 'the stack was released by the dispatch stage and is not needed again'};
    }
    const session = ctx.flags.session ?? null;
    const last = newestIntactAttempt(ctx.dir);
    if (!last) {
        return {
            reuse: false,
            reason: attemptNumbers(ctx.dir).length ? 'earlier_attempt_files_changed' : 'initial',
        };
    }
    if (last.outcome !== 'pass') {
        return {reuse: false, reason: 'previous_attempt_failed'};
    }
    if (!session) {
        return {reuse: false, reason: 'no_session_fixture_to_probe'};
    }
    const setup = readJson(path.join(ctx.dir, last.dir, 'setup.json'));
    const now = currentInputs(ctx.flags.target, session);
    for (const name of Object.keys(now)) {
        if (setup[name] !== now[name]) {
            return {reuse: false, reason: `inputs_changed:${name}`};
        }
    }
    const declared = declaredBookmarks(loadCharter(session));
    const manifest = readManifest();
    const check = checkManifestSession(manifest, session, declared);
    if (!check.ok || check.fingerprint !== setup.fixture_fingerprint) {
        return {reuse: false, reason: `probe_failed:${check.ok ? 'manifest_fingerprint_differs' : check.failures[0]}`};
    }
    const probe = await probeFixture({manifest, declared, expectedFingerprint: setup.fixture_fingerprint});
    if (!probe.ok) {
        return {reuse: false, reason: `probe_failed:${probe.reason}`};
    }
    return {reuse: true, holdsStack: true, note: `fixture probe ok, fingerprint ${probe.fingerprint.slice(0, 12)}`};
}

async function liveAttempt(ctx, kind, target, session) {
    const infra = infraPaths();
    const t = infraTarget(kind);
    const sessionArgs = session ? [`--session=${session}`] : [];
    const commands = [
        ['bash', GATE_SH, '--keep', `--target=${t}`],
        ['bash', UP_SH, `--target=${t}`, ...sessionArgs],
    ];
    const base = {live: true, started: false, licence: 'not_run', gate: 'not_run', commands};
    if (!process.env.MM_LICENSE) {
        return {
            stack: base,
            outcome: 'blocked',
            detail: 'MM_LICENSE is not exported in this shell (presence checked, value never read)',
        };
    }
    state.started = true;
    const gate = ctx.exec(['bash', infra.gate, '--keep', `--target=${t}`], {capture: true});
    const parsed = parseGate(gate.stdout);
    const stack = {...base, started: true, licence: parsed.licence, gate: parsed.gate};
    if (gate.status !== 0 || parsed.gate !== 'PASS' || parsed.licence !== 'PASS') {
        return {
            stack,
            outcome: 'fail',
            detail: `isolation and licence gate failed (gate ${parsed.gate}, licence ${parsed.licence}); a setup failure`,
        };
    }
    const up = ctx.exec(['bash', infra.up, `--target=${t}`, ...sessionArgs]);
    if (up.status !== 0) {
        return {stack, outcome: 'fail', detail: 'up.sh did not bring the stack up'};
    }
    if (!session) {
        return {stack, outcome: 'pass'};
    }
    const declared = declaredBookmarks(loadCharter(session));
    const manifest = readManifest();
    const check = checkManifestSession(manifest, session, declared);
    if (!check.ok) {
        return {
            stack,
            outcome: 'fail',
            detail: `seed manifest session check failed (${check.failures.join(', ')}); a setup failure`,
            manifestCheck: check,
        };
    }
    const probe = await probeFixture({manifest, declared, expectedFingerprint: check.fingerprint});
    if (!probe.ok) {
        return {
            stack,
            outcome: 'fail',
            detail: `the seeded fixture did not pass the live probe (${probe.reason}); a setup failure`,
            manifestCheck: check,
        };
    }
    return {stack, outcome: 'pass', manifestCheck: check, fingerprint: check.fingerprint, declared};
}

function attemptRecord({attempt, reason, outcome, detail, session, files}) {
    return {
        schema: 'explorer-stage0-attempt/v1',
        attempt,
        outcome,
        reason,
        ...(detail ? {detail: detail.slice(0, 300)} : {}),
        session: session ?? null,
        files,
    };
}

function releaseStack() {
    state.started = false;
    return spawnSync('bash', [infraPaths().down], {cwd: REPO_ROOT, stdio: 'ignore'});
}

/** Stops the stack through down.sh and reports whether anything of it is left. */
export function releaseStackAndConfirm() {
    const done = releaseStack();
    const infra = infraPaths();
    const manifestGone = !fs.existsSync(infra.manifest);
    const forwarderGone = !fs.existsSync(infra.forwarderPid);
    let containers = 0;
    if (!infra.overridden) {
        const ps = spawnSync('docker', ['ps', '-a', '--filter', 'name=explorer-pilot', '--format', '{{.Names}}'], {
            encoding: 'utf8',
        });
        containers = ps.status === 0 ? ps.stdout.split('\n').filter(Boolean).length : -1;
    }
    return {
        command: ['bash', DOWN_SH],
        exit_code: done.status ?? 1,
        manifest_removed: manifestGone,
        forwarder_stopped: forwarderGone,
        containers_left: containers,
        confirmed: done.status === 0 && manifestGone && forwarderGone && containers === 0,
    };
}

export default {
    index: 0,
    name: 'target',
    modes: ['explore', 'author', 'both'],
    liveReuse,

    inputs(ctx) {
        const kind = ctx.flags.target;
        const {ref} = readJson(targetFile(kind));
        return [
            {target_file: sha256File(targetFile(kind))},
            {lib_sh: sha256File(LIB_SH)},
            {tag: kind === 'release' ? gitCommitOf(ref) : null},
            {session: ctx.flags.session ?? null},
        ];
    },

    adoptStack() {
        state.started = true;
    },

    async run(ctx) {
        const kind = ctx.flags.target;
        const file = targetFile(kind);
        const target = readJson(file);
        const shape = validate('target', target);
        if (!shape.ok) {
            throw new Error(`target file ${repoRel(file)} is invalid: ${shape.errors.join('; ')}`);
        }
        if (target.kind !== kind) {
            throw new Error(`target file kind ${target.kind} does not match --target ${kind}`);
        }
        const session = ctx.flags.session ?? null;
        if (session && !INFRA_SESSIONS.includes(session)) {
            throw new Error(`infra cannot seed session ${session} (known: ${INFRA_SESSIONS.join(', ')})`);
        }
        const checks = staticChecks(kind, target);
        const t = infraTarget(kind);
        let stack = {
            live: false,
            started: false,
            licence: 'not_run',
            gate: 'not_run',
            commands: [
                ['bash', GATE_SH, '--keep', `--target=${t}`],
                ['bash', UP_SH, `--target=${t}`, ...(session ? [`--session=${session}`] : [])],
            ],
        };
        let outcome = {result: 'skipped', reason: 'skipped: not live (target checked statically; no stack started)'};
        let finalTarget = target;
        let live = null;

        if (ctx.flags.live) {
            live = await liveAttempt(ctx, kind, target, session);
            stack = live.stack;
            if (live.outcome !== 'blocked') {
                finalTarget = {...target, licence_check: stack.licence === 'PASS' ? 'PASS' : 'FAIL'};
            }
            outcome =
                live.outcome === 'pass'
                    ? {result: 'pass'}
                    : {result: live.outcome === 'blocked' ? 'blocked' : 'fail', reason: live.detail};
        }
        if (checks.some((c) => c.result === 'fail')) {
            outcome = {
                result: 'fail',
                reason: `target check failed: ${checks
                    .filter((c) => c.result === 'fail')
                    .map((c) => c.id)
                    .join(', ')}`,
            };
        } else if (!ctx.flags.live) {
            outcome = {result: 'pass', reason: 'target verified statically; licence and stack are live-only'};
        }

        const checkDoc = {schema: 'explorer-target-check/v1', kind, target_file: repoRel(file), checks, stack};
        ctx.writeJson('target.json', finalTarget, 'target');
        ctx.writeJson('target-check.json', checkDoc, 'orch#target-check');

        if (live) {
            const attempt = Math.max(0, ...attemptNumbers(ctx.dir)) + 1;
            const dir = `attempt-${attempt}`;
            const inputs = currentInputs(kind, session);
            const [, digest] = imagePin(kind).split('@');
            ctx.writeJson(`${dir}/target.json`, finalTarget, 'target');
            ctx.writeJson(`${dir}/target-check.json`, checkDoc, 'orch#target-check');
            ctx.writeJson(
                `${dir}/setup.json`,
                {
                    schema: 'explorer-stage0-setup/v1',
                    attempt,
                    ...inputs,
                    image_digest: digest,
                    licence: stack.licence,
                    gate: stack.gate,
                    manifest_session_check: live.manifestCheck
                        ? {
                              result: live.manifestCheck.ok ? 'pass' : 'fail',
                              session_name: session,
                              bookmark_titles: live.manifestCheck.titles,
                              failures: live.manifestCheck.failures,
                          }
                        : null,
                    fixture_fingerprint: live.fingerprint ?? null,
                    probe: live.fingerprint ? 'pass' : 'not_run',
                },
                'orch#stage0-setup',
            );
            const files = Object.fromEntries(ATTEMPT_FILES.map((f) => [f, sha256File(path.join(ctx.dir, dir, f))]));
            const attemptOutcome = outcome.result === 'pass' || live.outcome === 'blocked' ? live.outcome : 'fail';
            ctx.writeJson(
                `${dir}/attempt.json`,
                attemptRecord({
                    attempt,
                    reason: ctx.rerunReason ?? 'initial',
                    outcome: attemptOutcome,
                    detail: outcome.reason,
                    session,
                    files,
                }),
                'orch#stage0-attempt',
            );
            writeStatus(ctx, session);
        }
        return outcome;
    },

    teardown(flags) {
        if (!state.started || flags.keepStack) {
            return;
        }
        releaseStack();
    },
};
