// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Self-test for replay_judge.mjs: every rejection has a hand-written fixture report.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    CONTROL_EXPECTATION,
    JUDGE_CASES,
    PASS_EXPECTATION,
    failingTest,
    mkReport,
    passingTest,
} from './fixtures/report_fixtures.mjs';
import {judge} from './replay_judge.mjs';
import {GATES_DIR} from './common.mjs';

function fixtureChecks() {
    return JUDGE_CASES.map((c) => {
        const result = judge({reports: c.reports, expectation: c.expectation});
        const rules = result.evidence.map((e) => e.rule);
        const missing = c.rules.filter((r) => !rules.includes(r));
        const ok = result.status === c.want && missing.length === 0;
        const detail = ok
            ? ''
            : `status ${result.status} (want ${c.want}); missing rules ${missing.join(',') || 'none'}; got ${rules.join(',')}`;
        return {name: `replay_judge: ${c.name}`, ok, detail};
    });
}

function cliChecks() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-judge-'));
    try {
        const write = (name, value) => {
            const file = path.join(dir, name);
            fs.writeFileSync(file, JSON.stringify(value));
            return file;
        };
        const run = (expectation, reports) => {
            const args = [
                path.join(GATES_DIR, 'replay_judge.mjs'),
                '--expect',
                write('expect.json', expectation),
                ...reports,
            ];
            return spawnSync(process.execPath, args, {encoding: 'utf8'});
        };
        const good = write('good.json', mkReport([failingTest(), passingTest()]));
        const bad = write('bad.json', mkReport([passingTest('PILOT-01 control target'), passingTest()]));
        const missing = path.join(dir, 'missing.json');
        return [
            {
                name: 'replay_judge CLI: control-fail report exits 0',
                ok: run(CONTROL_EXPECTATION, [good]).status === 0,
                detail: '',
            },
            {
                name: 'replay_judge CLI: wrong report exits 1',
                ok: run(CONTROL_EXPECTATION, [bad]).status === 1,
                detail: '',
            },
            {
                name: 'replay_judge CLI: unreadable report exits 3 (blocked)',
                ok: run(PASS_EXPECTATION, [missing]).status === 3,
                detail: '',
            },
            {
                name: 'replay_judge CLI: invalid expectation exits 2',
                ok: run({mode: 'nonsense'}, [good]).status === 2,
                detail: '',
            },
        ];
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
}

export function selftestChecks() {
    return [...fixtureChecks(), ...cliChecks()];
}

export function runSelftest() {
    const checks = selftestChecks();
    for (const c of checks) {
        process.stdout.write(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` :: ${c.detail}` : ''}\n`);
    }
    const failed = checks.filter((c) => !c.ok).length;
    process.stdout.write(`replay_judge selftest: ${checks.length - failed}/${checks.length} passed\n`);
    return failed === 0 ? 0 : 1;
}
