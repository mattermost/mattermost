// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Self-test for static_spec_check.mjs: one bad snippet per rule, good snippets, and the real emitted specs.
import fs from 'node:fs';
import path from 'node:path';

import {GATES_DIR} from './common.mjs';
import {BAD_CASES, CONFORMED_SPECS, GOOD_CASES, JOURNEY_SPEC, REAL_SPECS, wrap} from './fixtures/static_cases.mjs';
import {RULES, checkSource, loadTypeScript, resolveTimeouts} from './static_spec_check.mjs';

const SPECS = path.join(GATES_DIR, 'fixtures/specs');
const rulesOf = (evidence) => [...new Set(evidence.map((e) => e.rule))].sort();
const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export function selftestChecks() {
    if (!loadTypeScript()) {
        return [
            {
                name: 'static_spec_check: TypeScript compiler API available',
                ok: false,
                detail: 'missing under e2e-tests/playwright/node_modules',
            },
        ];
    }
    const checks = [];
    const check = (name, ok, detail = '') => checks.push({name: `static_spec_check: ${name}`, ok, detail});
    const options = {timeouts: {testTimeoutMs: 60000, expectTimeoutMs: 10000}};

    for (const c of BAD_CASES) {
        const evidence = checkSource({file: 'bad.spec.ts', text: c.source ?? wrap(c.body)}, options);
        const got = rulesOf(evidence);
        check(`bad [${c.rule}] ${c.name}`, sameSet(got, c.rules), `got ${got.join(',') || 'nothing'}`);
    }
    const covered = new Set(BAD_CASES.map((c) => c.rule));
    const uncovered = Object.keys(RULES).filter((r) => !covered.has(r));
    check('every rule has at least one bad snippet', uncovered.length === 0, `uncovered: ${uncovered.join(',')}`);
    check(
        `bad snippets caught: ${BAD_CASES.length}/${BAD_CASES.length}`,
        BAD_CASES.every(
            (c) => rulesOf(checkSource({file: 'bad.spec.ts', text: c.source ?? wrap(c.body)}, options)).length > 0,
        ),
    );

    for (const c of GOOD_CASES) {
        const evidence = checkSource({file: 'good.spec.ts', text: wrap(c.body)}, options);
        check(`good: ${c.name}`, evidence.length === 0, `got ${rulesOf(evidence).join(',')}`);
    }

    for (const real of [...REAL_SPECS, JOURNEY_SPEC]) {
        const text = fs.readFileSync(path.join(SPECS, real.file), 'utf8');
        const got = rulesOf(checkSource({file: real.file, text}, options));
        check(
            `real emitted spec ${real.origin} trips exactly [${real.rules.join(', ') || 'nothing'}]`,
            sameSet(got, real.rules),
            `got ${got.join(',') || 'nothing'}`,
        );
    }
    for (const file of CONFORMED_SPECS) {
        const text = fs.readFileSync(path.join(SPECS, file), 'utf8');
        const evidence = checkSource({file, text}, options);
        check(`good spec ${file} passes`, evidence.length === 0, `got ${rulesOf(evidence).join(',')}`);
    }

    const sample = checkSource({file: 'bad.spec.ts', text: wrap("const password = 'Hunter2!pass';")}, options)[0];
    check('secrets never reach the evidence snippet', !JSON.stringify(sample).includes('Hunter2'));
    check(
        'evidence snippets are at most 80 characters',
        BAD_CASES.every((c) =>
            checkSource({file: 'x', text: c.source ?? wrap(c.body)}, options).every((e) => e.snippet.length <= 80),
        ),
    );
    const first = JSON.stringify(checkSource({file: 'x', text: wrap(BAD_CASES[3].body)}, options));
    check(
        'output is deterministic',
        first === JSON.stringify(checkSource({file: 'x', text: wrap(BAD_CASES[3].body)}, options)),
    );
    const tight = checkSource(
        {file: 'x', text: wrap([GOOD_CASES[9].body].join('\n'))},
        {timeouts: {testTimeoutMs: 20000, expectTimeoutMs: 10000}},
    );
    check('timeout-risk follows the configured test timeout', rulesOf(tight).includes('timeout-risk'));
    const cap = checkSource(
        {file: 'x', text: wrap(GOOD_CASES[9].body)},
        {timeouts: {testTimeoutMs: 60000, expectTimeoutMs: 10000}, maxConsecutiveSoft: 2},
    );
    check('the consecutive-soft cap is configurable', rulesOf(cap).includes('soft-consecutive'));
    const marked = wrap(
        "await expect(info.getByRole('button', {name: 'Edit', exact: true})).toHaveCount(0); // declared (c) // absence-verified: probe-7",
    );
    check(
        'a known probe id is accepted',
        checkSource({file: 'x', text: marked}, {...options, probeIds: ['probe-7']}).length === 0,
    );
    check(
        'an unknown probe id is rejected when the allowed ids are supplied',
        rulesOf(checkSource({file: 'x', text: marked}, {...options, probeIds: ['probe-1']})).join() ===
            'absence-exact-name',
    );
    const timeouts = resolveTimeouts({});
    check(
        'timeouts come from the repo Playwright config (60 s test, 10 s expect)',
        timeouts.testTimeoutMs === 60000 &&
            timeouts.expectTimeoutMs === 10000 &&
            timeouts.source.endsWith('playwright.config.ts'),
        JSON.stringify(timeouts),
    );
    return checks;
}
