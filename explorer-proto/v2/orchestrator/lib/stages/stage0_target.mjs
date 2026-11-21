// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, @stylistic/wrap-regex, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Stage 0, target: load and validate the target file, check its image pins against infra/scripts/lib.sh without Docker,
// and (only with --live) start the stack through the infra scripts and record the licence result as PASS or FAIL.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {PROTO_DIR, readJson, repoRel, REPO_ROOT, sha256File, V2_DIR, ORCH_DIR} from '../common.mjs';
import {validate} from '../schemas.mjs';

const INFRA_SCRIPTS = path.join(PROTO_DIR, 'infra', 'scripts');
const LIB_SH = path.join(INFRA_SCRIPTS, 'lib.sh');
const UP_SH = 'explorer-proto/infra/scripts/up.sh';
const GATE_SH = 'explorer-proto/infra/scripts/gate.sh';
const DOWN_SH = 'explorer-proto/infra/scripts/down.sh';

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
    const expected = pinFromLib(kind === 'main' ? 'MM_IMAGE_MAIN' : 'MM_IMAGE_DEFAULT');
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

function liveStack(ctx, kind) {
    const t = infraTarget(kind);
    const commands = [
        ['bash', GATE_SH, '--keep', `--target=${t}`],
        ['bash', UP_SH, `--target=${t}`],
    ];
    if (!process.env.MM_LICENSE) {
        return {blocked: 'MM_LICENSE is not exported in this shell (presence checked, value never read)', commands};
    }
    state.started = true;
    const gate = ctx.exec(['bash', path.join(REPO_ROOT, GATE_SH), '--keep', `--target=${t}`], {capture: true});
    const parsed = parseGate(gate.stdout);
    const stack = {live: true, started: true, licence: parsed.licence, gate: parsed.gate, commands};
    if (gate.status !== 0 || parsed.gate !== 'PASS' || parsed.licence !== 'PASS') {
        return {
            stack,
            failed: `isolation and licence gate failed (gate ${parsed.gate}, licence ${parsed.licence}); a setup failure`,
        };
    }
    const up = ctx.exec(['bash', path.join(REPO_ROOT, UP_SH), `--target=${t}`]);
    if (up.status !== 0) {
        return {stack, failed: 'up.sh did not bring the stack up'};
    }
    return {stack};
}

export default {
    index: 0,
    name: 'target',
    modes: ['explore', 'author', 'both'],
    runsEveryLiveInvocation: true,

    inputs(ctx) {
        const kind = ctx.flags.target;
        const {ref} = readJson(targetFile(kind));
        return [
            {target_file: sha256File(targetFile(kind))},
            {lib_sh: sha256File(LIB_SH)},
            {tag: kind === 'release' ? gitCommitOf(ref) : null},
        ];
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
        const checks = staticChecks(kind, target);
        const t = infraTarget(kind);
        let stack = {
            live: false,
            started: false,
            licence: 'not_run',
            gate: 'not_run',
            commands: [
                ['bash', GATE_SH, '--keep', `--target=${t}`],
                ['bash', UP_SH, `--target=${t}`],
            ],
        };
        let outcome = {result: 'skipped', reason: 'skipped: not live (target checked statically; no stack started)'};
        let finalTarget = target;

        if (ctx.flags.live) {
            const live = liveStack(ctx, kind);
            if (live.blocked) {
                stack = {...stack, live: true, commands: live.commands};
                outcome = {result: 'blocked', reason: live.blocked};
            } else {
                stack = live.stack;
                finalTarget = {...target, licence_check: stack.licence === 'PASS' ? 'PASS' : 'FAIL'};
                outcome = live.failed ? {result: 'fail', reason: live.failed} : {result: 'pass'};
            }
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

        ctx.writeJson('target.json', finalTarget, 'target');
        ctx.writeJson(
            'target-check.json',
            {schema: 'explorer-target-check/v1', kind, target_file: repoRel(file), checks, stack},
            'orch#target-check',
        );
        return outcome;
    },

    teardown(flags) {
        if (!state.started || flags.keepStack) {
            return;
        }
        state.started = false;
        spawnSync('bash', [path.join(REPO_ROOT, DOWN_SH)], {cwd: REPO_ROOT, stdio: 'ignore'});
    },
};
