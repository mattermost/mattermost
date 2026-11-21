// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Unit-level checks of the orchestrator's deterministic parts, run by selftest.mjs.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {GATES} from './gates/index.mjs';
import secretScan from './gates/secret_scan.mjs';
import specStatic from './gates/spec_static.mjs';
import {ORCH_DIR, readJson} from './lib/common.mjs';
import {judgeControlReport} from './lib/controls.mjs';
import {checkFeatureLeakage} from './lib/leakage.mjs';
import {validate} from './lib/schemas.mjs';
import {checkSpecText} from './lib/spec_check.mjs';

import {GATE_NAMES} from '../schemas/shared.mjs';

export async function unitChecks({check, assert, WORK, newDir, envWithoutLicence, FEATURE}) {
    await check('(8) the static spec check flags waitForTimeout, expect.soft and a CSS locator, and only those', () => {
        const planted = [
            "import {expect, test} from '@mattermost/playwright-lib';",
            '// page.waitForTimeout(100) in a comment is not code',
            "test('x', async ({pw}) => {",
            "    const note = 'expect.soft in a string is not code';",
            '    await page.waitForTimeout(500);',
            "    expect.soft(page.getByRole('button', {name: 'Save'})).toBeVisible();",
            "    await page.locator('.sidebar-item').click();",
            "    await page.getByRole('link', {name: 'Town Square', exact: true}).click();",
            "    await expect(page.getByRole('heading', {name: 'Town Square'})).toBeVisible();",
            '});',
            '',
        ].join('\n');
        const issues = checkSpecText(planted);
        const key = issues.map((i) => `${i.rule}@${i.line}`).join(',');
        assert(key === 'sleep@5,soft_assertion@6,css_locator@7', `unexpected issues: ${key}`);
        const clean = planted
            .split('\n')
            .filter((l, i) => ![4, 5, 6].includes(i))
            .join('\n');
        assert(checkSpecText(clean).length === 0, 'a clean spec must produce no issue');
        assert(
            checkSpecText('await page.locator(\'role=button[name="Save"]\').click();').length === 0,
            'a role selector engine is not CSS',
        );
        assert(
            checkSpecText('expect.configure({soft: true});').some((i) => i.rule === 'soft_assertion'),
            'expect.configure soft',
        );
        const file = path.join(WORK, 'planted.spec.ts');
        fs.writeFileSync(file, planted);
        const gate = specStatic.run({specs: [{rel: 'planted.spec.ts', abs: file}]});
        return gate.then((g) => {
            assert(
                g.result === 'fail' && g.failed_at.line === 5 && g.counts.passed === 0,
                `gate result ${JSON.stringify(g)}`,
            );
            const none = specStatic.run({specs: []});
            return none.then((b) =>
                assert(b.result === 'blocked' && b.blocked_reason === 'environment', 'no spec means blocked, not pass'),
            );
        });
    });

    await check('gate registry: every gate has the common interface and a legal verdict gate name', async () => {
        assert(GATES.length >= 10, 'ten gates are shipped');
        const ids = new Set();
        for (const g of GATES) {
            assert(typeof g.id === 'string' && !ids.has(g.id), `duplicate or missing id ${g.id}`);
            ids.add(g.id);
            assert(
                GATE_NAMES.includes(g.gate) &&
                    typeof g.description === 'string' &&
                    typeof g.liveOnly === 'boolean' &&
                    typeof g.run === 'function',
                `${g.id} interface`,
            );
        }
        for (const required of [
            'schema-valid-artifacts',
            'leakage',
            'duplicate-gate-ran',
            'spec-static',
            'no-secret-no-origin',
            'repeat-replay',
            'mutation-control',
        ]) {
            assert(ids.has(required), `missing gate ${required}`);
        }
    });

    await check('gates: secret and origin scan (synthetic licence value), control judge', async () => {
        const dir = newDir('scan');
        fs.mkdirSync(path.join(dir, '4-select'), {recursive: true});
        fs.writeFileSync(path.join(dir, '4-select/clean.json'), '{"ok": true}');
        const synthetic = 'selftest-synthetic-value-not-a-licence-0123456789abcdef';
        const ctx = (env) => ({
            out: dir,
            charterFile: '4-select/clean.json',
            exec: (argv, {capture} = {}) => {
                const r = spawnSync(argv[0], argv.slice(1), {
                    encoding: 'utf8',
                    env,
                    stdio: capture ? ['ignore', 'pipe', 'ignore'] : 'ignore',
                });
                return {status: r.status ?? 1, stdout: r.stdout ?? ''};
            },
        });
        const saved = process.env.MM_LICENSE;
        try {
            delete process.env.MM_LICENSE;
            const unset = await secretScan.run(ctx(envWithoutLicence()));
            assert(
                unset.result === 'blocked' && unset.blocked_reason === 'environment',
                `unset licence must block, got ${unset.result}`,
            );
            process.env.MM_LICENSE = synthetic;
            const clean = await secretScan.run(ctx({...process.env}));
            assert(clean.result === 'pass', `clean tree must pass, got ${clean.result}`);
            fs.writeFileSync(path.join(dir, '4-select/leaky.json'), JSON.stringify({note: synthetic}));
            const leaked = await secretScan.run(ctx({...process.env}));
            assert(leaked.result === 'fail', `a leaked value must fail, got ${leaked.result}`);
            fs.rmSync(path.join(dir, '4-select/leaky.json'));
            fs.writeFileSync(
                path.join(dir, '4-select/origin.json'),
                JSON.stringify({note: 'see http://127.0.0.1:8065/x'}),
            );
            const origin = await secretScan.run(ctx({...process.env}));
            assert(
                origin.result === 'fail' && origin.evidence[0].ref === '4-select/origin.json',
                'an origin string must fail',
            );
        } finally {
            if (saved === undefined) {
                delete process.env.MM_LICENSE;
            } else {
                process.env.MM_LICENSE = saved;
            }
        }
        const failing = (message) => ({
            suites: [{specs: [{title: 't', tests: [{results: [{status: 'failed', errors: [{message}]}]}]}]}],
        });
        const named = "expect(info.getByRole('button', {name: 'Unarchive', exact: true})).toHaveCount(0)";
        assert(
            judgeControlReport(failing(`Error: ${named}\nReceived: 1`), named).pass,
            'failure at the named assertion passes the control',
        );
        assert(
            !judgeControlReport(failing('Error: expect(locator).toBeVisible()'), named).pass,
            'another assertion fails the control',
        );
        assert(
            !judgeControlReport(failing(`Test timeout of 60000ms exceeded ${named}`), named).pass,
            'a timeout never passes',
        );
        assert(
            !judgeControlReport({suites: [{specs: [{title: 't', tests: [{results: [{status: 'passed'}]}]}]}]}, named)
                .pass,
            'a replay that still passes fails the control',
        );
    });

    await check(
        'features: both ship without route or ordered steps and pass the leakage check; a leaky feature fails it',
        () => {
            for (const id of ['channels.create-and-modals', 'channels.favorites']) {
                const feature = readJson(path.join(ORCH_DIR, 'features', `${id}.json`));
                assert(validate('feature', feature).ok, `${id} schema`);
                const leak = checkFeatureLeakage(feature);
                assert(leak.pass, `${id} leakage: ${JSON.stringify(leak.violations)}`);
            }
            const feature = readJson(path.join(ORCH_DIR, 'features', `${FEATURE}.json`));
            const leaky = {
                ...feature,
                title: 'Open the sidebar, then click Favorites',
                ordered_steps: ['a'],
                goal: 'I want to press the menu then select the item.',
            };
            const result = checkFeatureLeakage(leaky);
            assert(
                !result.pass &&
                    result.violations.some((v) => v.rule === 'L5') &&
                    result.violations.some((v) => v.rule === 'L1'),
                `leaky feature must fail: ${JSON.stringify(result.violations)}`,
            );
            assert(!validate('feature', leaky).ok, 'schema rejects a steps key');
        },
    );
}
