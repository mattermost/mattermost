// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import * as prettier from 'prettier';

import {COVERAGE_PATH, PLAYWRIGHT_DIR, SRC_DIR} from './paths.ts';
import {SCOPE, absenceLocator, matchesName, parseStatement, unconfirmedLabel} from './assertions.ts';
import type {AbsenceAssertion, Assertion} from './assertions.ts';
import {parseStep, readScenarios, startPath} from './scenarios.ts';
import type {Scenario} from './scenarios.ts';
import {describe, parseSnapshot, printable, roleNameCounts, stripGlyphs, walk} from './snapshot.ts';
import type {RoleName, SnapNode} from './snapshot.ts';
import {readTrace, writeTrace} from './trace.ts';
import type {EmissionRecord, Trace, TraceState, TraceTransition} from './trace.ts';

function q(text: string): string {
    return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function roleLocator(base: string, role: string, name: string): string {
    return `${base}.getByRole(${q(role)}, {name: ${q(name)}, exact: true})`;
}

function assertionCode(a: Assertion): string {
    switch (a.kind) {
        case 'url':
            return `await expect(page).toHaveURL((url) => url.pathname === ${q(a.path)});`;
        case 'visible':
            if (!a.scoped && a.role === SCOPE.role && a.name === SCOPE.name) {
                return 'await expect(info).toBeVisible();';
            }
            return `await expect(${roleLocator(a.scoped ? 'info' : 'page', a.role, a.name)}).toBeVisible();`;
        case 'textVisible':
            return `await expect(info.getByText(${q(a.text)}, {exact: true})).toBeVisible();`;
        case 'count0':
            return a.match === 'contains'
                ? `await expect(info.getByRole(${q(a.role)}, {name: /${a.name}/})).toHaveCount(0);`
                : `await expect(${roleLocator('info', a.role, a.name)}).toHaveCount(0);`;
        case 'contains':
            return `await expect.soft(info)${a.negated ? '.not' : ''}.toContainText(${q(a.text)});`;
    }
    throw new Error('Unknown assertion kind');
}

function subtree(nodes: SnapNode[], role: string, name: string): SnapNode[] {
    let found: SnapNode[] = [];
    walk(nodes, (n) => {
        if (found.length === 0 && n.role === role && n.name === name) {
            found = n.children;
        }
    });
    return found;
}

function textOf(nodes: SnapNode[]): string {
    const lines: string[] = [];
    walk(nodes, (n) => lines.push(n.line));
    return lines.join('\n');
}

function countIn(nodes: SnapNode[], rn: RoleName, match: AbsenceAssertion['match'] = 'exact'): number {
    return roleNameCounts(nodes)
        .filter((x) => x.role === rn.role && matchesName(x.name, {name: rn.name, match}))
        .reduce((sum, x) => sum + x.count, 0);
}

/**
 * Checks a declared assertion against the snapshot the explorer observed at that checkpoint.
 * Returns a problem (stop the scenario) or a note. Never feeds an observed value back into the spec.
 */
function checkAgainstLive(
    s: Scenario,
    a: Assertion,
    state: TraceState,
    trace: Trace,
): {problem?: string; note?: string} {
    const nodes = parseSnapshot(state.snapshot);
    const region = subtree(nodes, SCOPE.role, SCOPE.name);
    const where = `state ${state.id}`;
    switch (a.kind) {
        case 'url':
            return state.pathname === a.path
                ? {note: `URL ${a.path} matches ${where}`}
                : {problem: `declared URL ${a.path} but ${where} is at ${state.pathname}`};
        case 'visible': {
            const scope = a.scoped ? region : nodes;
            const n = countIn(scope, a);
            if (n >= 1) {
                const pageWide = countIn(nodes, a);
                const ambiguity =
                    a.scoped && pageWide > 1 ? `; ${pageWide} page-wide, so the region scope is required` : '';
                return {
                    note: `${describe(a)} observed exactly ${n}x${a.scoped ? ' in region "Info"' : ''} in ${where}${ambiguity}`,
                };
            }
            return {
                problem: `${describe(a)} declared visible but not observed exactly in ${where}${nearMatch(a, trace)}`,
            };
        }
        case 'textVisible':
            return textOf(region).includes(a.text)
                ? {note: `text ${q(a.text)} observed in region "Info" in ${where}`}
                : {problem: `text ${q(a.text)} declared visible but not observed in region "Info" in ${where}`};
        case 'count0': {
            const label = `${describe(a)} (${a.match} name)`;
            if (countIn(region, a, a.match) > 0) {
                return {problem: `${label} declared absent but observed in region "Info" in ${where}`};
            }
            const elsewhere = trace.states
                .filter((st) => countIn(parseSnapshot(st.snapshot), a, a.match) > 0)
                .map((st) => st.id);
            if (elsewhere.length > 0) {
                return {note: `${label} absent in ${where}; locator matches live elements in ${elsewhere.join(', ')}`};
            }
            const near = a.match === 'exact' ? nearMatch(a, trace) : '';
            if (near) {
                return {
                    note: `WARNING ${label} never observed in any explored state${near}; this count-0 assertion may pass vacuously`,
                };
            }
            return {note: `${unconfirmedLabel(absenceLocator(s, a))}: ${label} never present in any explored state`};
        }
        case 'contains': {
            const present = textOf(region).includes(a.text);
            if (present === !a.negated) {
                return {note: `region "Info" ${a.negated ? 'lacks' : 'contains'} ${q(a.text)} in ${where}`};
            }
            return {
                problem: `declared ${a.negated ? 'absent' : 'present'} text ${q(a.text)} disagrees with region "Info" in ${where}`,
            };
        }
    }
    throw new Error('Unknown assertion kind');
}

function nearMatch(rn: RoleName, trace: Trace): string {
    for (const s of trace.states) {
        for (const x of roleNameCounts(parseSnapshot(s.snapshot))) {
            if (x.role === rn.role && x.name !== rn.name && stripGlyphs(x.name) === rn.name) {
                return `; live accessible name is "${printable(x.name)}" (icon glyph in the name, ${s.id})`;
            }
        }
    }
    return '';
}

/** Matrix status for a scenario's matrix_ref, read from the coverage.md scenario matrix table. */
export function coverageStatus(coverage: string, matrixRef: string): string {
    for (const line of coverage.split('\n')) {
        const cells = line.split('|').map((c) => c.trim().replace(/\*\*/g, ''));
        if (cells[1] === matrixRef && cells.length >= 6) {
            return cells[4];
        }
    }
    throw new Error(`coverage.md has no matrix row for ${matrixRef}`);
}

function same(a: RoleName, b: RoleName) {
    return a.role === b.role && a.name === b.name;
}

function regionSmoke(t: TraceTransition): string[] {
    return t.changes
        .map((c) => /^(region|dialog|alertdialog) "(.*)" appeared$/.exec(c))
        .filter((m): m is RegExpExecArray => Boolean(m))
        .map((m) => {
            const target =
                m[1] === SCOPE.role && m[2] === SCOPE.name
                    ? 'info'
                    : roleLocator('page', m[1], m[2].replace(/\\(.)/g, '$1'));
            return `await expect(${target}).toBeVisible(); // smoke: observed transition #${t.n} (${m[1]} "${m[2]}" appeared)`;
        });
}

function gotoCode(pathname: string): string[] {
    const channel = /^\/([^/]+)\/channels\/([^/]+)$/.exec(pathname);
    if (channel) {
        return [
            `await channelsPage.goto(${q(channel[1])}, ${q(channel[2])});`,
            // The composer helper (channelsPage.toBeVisible) fails on archived channels, so wait on the header.
            'await channelsPage.centerView.header.toBeVisible();',
        ];
    }
    return [`await page.goto(${q(pathname)});`];
}

function lowerFirst(text: string): string {
    return text.charAt(0).toLowerCase() + text.slice(1);
}

type Plan = {lines: string[]; pathLabels: string[]; record: EmissionRecord};

/** Walks the declared steps over the discovered transitions and builds the test body, or stops. */
function plan(s: Scenario, trace: Trace): Plan | EmissionRecord {
    const record: EmissionRecord = {scenario: s.id, status: 'stopped', reasons: [], locatorChecks: []};
    const root = trace.roots.find((r) => r.path === startPath(s));
    if (!root || root.state === 'none') {
        record.reasons.push(`start path ${startPath(s)} was not explored`);
        return record;
    }
    let state = trace.states.find((st) => st.id === root.state)!;
    const lines: string[] = [
        `// # Go to ${startPath(s)} (exploration root, state ${state.id})`,
        ...gotoCode(startPath(s)),
    ];
    const pathLabels: string[] = [];
    let lastTransition: TraceTransition | null = null;

    for (const raw of s.reachable_path.slice(1)) {
        const step = parseStep(raw);
        if (step.kind === 'click') {
            if (!s.allowed_controls.some((c) => same(c, step))) {
                record.reasons.push(`declared step "${raw}" uses a control outside ${s.id} allowed_controls`);
                return record;
            }
            const t = trace.transitions.find((tr) => tr.from === state.id && same(tr.action, step));
            if (!t || t.to === state.id) {
                const seen = state.candidates.map(describe).join('; ') || 'none';
                record.reasons.push(
                    `declared step "${raw}" not discovered from state ${state.id}${t ? ' (no-op)' : ''}; candidates there: ${seen}`,
                );
                return record;
            }
            const next = trace.states.find((st) => st.id === t.to);
            if (!next) {
                record.reasons.push(`transition #${t.n} leads to unrecorded state ${t.to} (budget)`);
                return record;
            }
            record.locatorChecks.push(
                `${describe(step)} matched the allowlist exactly and was unique in state ${state.id}`,
            );
            pathLabels.push(`#${t.n} click ${describe(t.action)}`);
            const effects = t.changes.filter((c) => /^(?:region|dialog|alertdialog) .*appeared$|^URL path/.test(c));
            lines.push(
                '',
                `// # Click ${describe(t.action)} (discovered: trace #${t.n}, ${effects.join(', ') || t.changes.join(', ')})`,
                `await ${roleLocator('page', t.action.role, t.action.name)}.click();`,
                ...regionSmoke(t),
            );
            lastTransition = t;
            state = next;
        } else if (step.kind === 'checkpoint') {
            const key = step.label.replace(/ assertions$/, '').replace(/[- ]/g, '_');
            const statements = s.expected_outcome[key];
            if (!lastTransition || !statements) {
                record.reasons.push(`checkpoint "${step.label}" has no preceding action or no expected_outcome entry`);
                return record;
            }
            lines.push('', `// * Checkpoint ${key}: declared (scenarios.json ${s.id} expected_outcome.${key})`);
            for (const statement of statements) {
                let assertions: Assertion[];
                try {
                    assertions = parseStatement(statement);
                } catch (error) {
                    record.reasons.push(String((error as Error).message));
                    return record;
                }
                for (const a of assertions) {
                    let problem: string | undefined;
                    let note: string | undefined;
                    try {
                        const locator = a.kind === 'count0' ? absenceLocator(s, a) : undefined;
                        ({problem, note} = checkAgainstLive(s, a, state, trace));
                        if (locator?.name_match === 'contains') {
                            lines.push(
                                '// Substring name on purpose: the live name carries an icon glyph prefix, so an exact name could not detect presence.',
                            );
                        }
                    } catch (error) {
                        problem = String((error as Error).message);
                    }
                    if (problem) {
                        record.reasons.push(`STOP: scenarios.json differs from the live UI: ${problem}`);
                        return record;
                    }
                    record.locatorChecks.push(note!);
                    if (note!.startsWith('UNCONFIRMED-BY-LIVE')) {
                        lines.push(
                            `// ${note!.slice(0, note!.indexOf('): ') + 1)}: never present in any explored state.`,
                        );
                    }
                    const warn = note!.startsWith('WARNING') ? ' WARNING: name not confirmed live, see trace.md' : '';
                    lines.push(`${assertionCode(a)} // declared (scenarios.json ${s.id})${warn}`);
                }
            }
        }
    }
    return {lines, pathLabels, record};
}

function render(s: Scenario, lines: string[], importPath: string): string {
    const body = lines.map((l) => (l ? `        ${l}` : '')).join('\n');
    return `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Generated by explorer-proto/src/emit.ts from trace.json (discovered actions and locators) and
// scenarios.json ${s.id} (declared assertions). Do not edit by hand; re-run explore + emit instead.
// No pw.skipIfNoLicense(): nothing here depends on a licensed feature.

import {expect, test} from '@mattermost/playwright-lib';

import {closeGuardedSessions, openGuardedSession} from '${importPath}';

test.afterEach(closeGuardedSessions);

/**
 * @objective ${s.title} (${s.matrix_ref}).
 * Seed-bound text checks use expect.soft so a negative-control seed reports every failing declared string
 * while navigation and visibility stay hard assertions.
 */
test(
    ${q(`${s.id} ${lowerFirst(s.title)}`)},
    {tag: ['@channels', '@channel_info', '@explorer_pilot']},
    async ({pw}) => {
        const {page, channelsPage} = await openGuardedSession(pw);
        const info = page.getByRole('region', {name: 'Info', exact: true});

${body}
    },
);
`;
}

export async function emit(dir: string): Promise<EmissionRecord[]> {
    const prettierOptions = await prettier.resolveConfig(path.join(PLAYWRIGHT_DIR, 'playwright.config.ts'));
    if (!prettierOptions) {
        throw new Error('e2e-tests/playwright Prettier config not found.');
    }
    const trace = readTrace(dir);
    const scenarios = readScenarios();
    const coverage = fs.readFileSync(COVERAGE_PATH, 'utf-8');
    const importPath = path.relative(dir, path.join(SRC_DIR, 'session')).split(path.sep).join('/');
    const records: EmissionRecord[] = [];
    const emittedPaths = new Map<string, string>();

    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.spec.ts'))) {
        fs.rmSync(path.join(dir, file));
    }

    for (const s of scenarios) {
        const status = coverageStatus(coverage, s.matrix_ref);
        const dedupe = `dedupe_key ${s.dedupe_key}: ${s.matrix_ref} is ${status} in coverage.md`;
        if (/^COVERED/.test(status)) {
            records.push({scenario: s.id, status: 'deduped', reasons: [`deduped: ${dedupe}`], locatorChecks: []});
            continue;
        }
        const result = plan(s, trace);
        if (!('lines' in result)) {
            result.reasons.unshift(`${dedupe}, not covered`);
            records.push(result);
            continue;
        }
        const {lines, pathLabels, record} = result;
        const pathKey = `${startPath(s)} ${pathLabels.join(' > ')}`;
        if (emittedPaths.has(pathKey)) {
            records.push({
                ...record,
                status: 'deduped',
                reasons: [`deduped: identical discovered action path already emitted for ${emittedPaths.get(pathKey)}`],
            });
            continue;
        }
        emittedPaths.set(pathKey, s.id);
        const file = `${s.id.toLowerCase().replace(/-/g, '_')}_${s.matrix_ref.toLowerCase().replace(/-/g, '_')}.spec.ts`;
        const source = await prettier.format(render(s, lines, importPath), {...prettierOptions, parser: 'typescript'});
        fs.writeFileSync(path.join(dir, file), source);
        records.push({
            ...record,
            status: 'emitted',
            file,
            path: [`navigate ${startPath(s)}`, ...pathLabels],
            reasons: [`${dedupe}, not covered -> emitted`],
        });
    }

    writeTrace(dir, {...trace, emission: records});
    return records;
}
