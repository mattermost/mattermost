#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Runs every unit test of the v2 gates against deliberately bad inputs. Exit 0 only if every check passes.
// Usage: node explorer-proto/v2/gates/selftest.mjs [--quiet]   (prints only failures and the summary)
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {parseArgs, runCli} from './common.mjs';
import {BAD_CASES} from './fixtures/static_cases.mjs';
import {JUDGE_CASES} from './fixtures/report_fixtures.mjs';

const GATE_MODULES = [
    './static_spec_check.mjs',
    './replay_judge.mjs',
    './stability_gate.mjs',
    './mutation_control.mjs',
    './lessons_guard.mjs',
    './containment_evidence.mjs',
];

async function interfaceChecks() {
    const checks = [];
    for (const file of GATE_MODULES) {
        const mod = await import(file);
        const name = file.slice(2);
        const shaped = typeof mod.gate?.id === 'string' && typeof mod.gate?.run === 'function';
        checks.push({name: `gate interface: ${name} exports gate {id, run}`, ok: shaped, detail: ''});
        if (!shaped) {
            continue;
        }
        for (const ctx of [undefined, {}, {files: 7, reports: 'x', plans: 'x', lessons: 'x', record: 7}]) {
            const result = await mod.gate.run(ctx);
            const ok =
                ['pass', 'fail', 'blocked'].includes(result?.status) &&
                Array.isArray(result?.evidence) &&
                result.status === 'blocked';
            checks.push({
                name: `gate interface: ${name} run(${ctx === undefined ? 'undefined' : JSON.stringify(ctx).slice(0, 30)}) is blocked, never a pass`,
                ok,
                detail: `status ${result?.status}`,
            });
        }
    }
    return checks;
}

const SUITES = [
    ['static_spec_check', './static_spec_check.selftest.mjs'],
    ['replay_judge', './replay_judge.selftest.mjs'],
    ['stability_gate', './stability_gate.selftest.mjs'],
    ['mutation_control', './mutation_control.selftest.mjs'],
    ['promote_decision', './promote_decision.selftest.mjs'],
    ['lessons_guard', './lessons_guard.selftest.mjs'],
    ['containment_evidence', './containment_evidence.selftest.mjs'],
];

async function main() {
    const {values} = parseArgs(process.argv.slice(2), {flags: ['quiet']});
    let total = 0;
    let failed = 0;
    const print = (line) => process.stdout.write(`${line}\n`);
    const report = (checks) => {
        for (const c of checks) {
            total++;
            if (!c.ok) {
                failed++;
            }
            if (!c.ok || !values.quiet) {
                print(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail && !c.ok ? ` :: ${c.detail}` : ''}`);
            }
        }
    };
    const perSuite = [];
    for (const [label, file] of SUITES) {
        const mod = await import(file);
        const checks = await mod.selftestChecks();
        report(checks);
        perSuite.push(`${label} ${checks.filter((c) => c.ok).length}/${checks.length}`);
    }
    const iface = await interfaceChecks();
    report(iface);
    perSuite.push(`gate_interface ${iface.filter((c) => c.ok).length}/${iface.length}`);

    print('');
    print(`suites: ${perSuite.join(', ')}`);
    print(
        `static_spec_check: ${BAD_CASES.length} bad snippets, ${new Set(BAD_CASES.map((c) => c.rule)).size} rules covered`,
    );
    print(`replay_judge: ${JUDGE_CASES.length} fixture reports`);
    print(`gates selftest: ${total - failed}/${total} checks passed${failed ? `, ${failed} FAILED` : ''}`);
    return failed === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runCli(main);
}
