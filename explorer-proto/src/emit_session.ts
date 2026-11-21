// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import * as prettier from 'prettier';

import {charterAllowlist, charterBudget, dedupeStatus, evaluateCharter, readCharter, specStem} from './charter.ts';
import type {Charter, Expectation, Predicate} from './charter.ts';
import {PLAYWRIGHT_DIR, SRC_DIR} from './paths.ts';
import {assertSanitized, readSessionTrace, writeSessionTrace} from './session_trace.ts';
import type {SessionEmission, SessionState, SessionTrace} from './session_trace.ts';
import {describe} from './snapshot.ts';

function q(text: string): string {
    return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function camel(scope: string): string {
    return scope.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

class Stop extends Error {}

function stop(message: string): never {
    throw new Stop(message);
}

/** Variable name and test id for each non-page locator scope named in locator_scope by its getByTestId(). */
function scopeFor(charter: Charter, testid: string): string {
    const scopes = Object.entries(charter.locator_scope ?? {})
        .filter(([, text]) => text.includes(`getByTestId('${testid}')`))
        .map(([key]) => key);
    if (scopes.length !== 1 || !/^[a-z][a-z0-9_]*$/.test(scopes[0]) || scopes[0] === 'page') {
        stop(`testid ${testid} must be named by exactly one locator_scope entry with a plain identifier key`);
    }
    return scopes[0];
}

/** Positive expectations first, absence last (name_match_rules.ordering); stable within each group. */
function ordered(p: Predicate): Expectation[] {
    const rank = (e: Expectation) => {
        if (e.kind === 'role') {
            return e.count > 0 ? 2 : 3;
        }
        return e.kind === 'url_path' ? 0 : 1;
    };
    return p.expect
        .map((e, i) => ({e, i}))
        .sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i)
        .map((x) => x.e);
}

function expectationCode(charter: Charter, p: Predicate, e: Expectation, scopes: Map<string, string>): string[] {
    const tag = ` // declared (charter ${charter.feature_id} ${e.id})`;
    switch (e.kind) {
        case 'url_path':
            return [`await expect(page).toHaveURL((url) => url.pathname === ${q(e.equals)});${tag}`];
        case 'testid': {
            if (e.visible !== true) {
                stop(`${p.id}/${e.id}: only visible: true is supported for a testid expectation`);
            }
            const scope = scopeFor(charter, e.testid);
            scopes.set(scope, e.testid);
            return [`await expect(${camel(scope)}).toBeVisible();${tag}`];
        }
        case 'role': {
            let base = 'page';
            if (e.scope !== 'page') {
                const testid = p.expect.find(
                    (x): x is Extract<Expectation, {kind: 'testid'}> =>
                        x.kind === 'testid' && scopeFor(charter, x.testid) === e.scope,
                );
                if (!testid) {
                    stop(`${p.id}/${e.id}: scope ${e.scope} has no testid expectation in the same predicate`);
                }
                scopes.set(e.scope, testid.testid);
                base = camel(e.scope);
            }
            if (e.count > 0) {
                if (e.match !== 'exact') {
                    stop(`${p.id}/${e.id}: a presence check must use an exact name, not ${e.match}`);
                }
                const locator = `${base}.getByRole(${q(e.role)}, {name: ${q(e.name)}, exact: true})`;
                return [
                    ...(e.visible ? [`await expect(${locator}).toBeVisible();${tag}`] : []),
                    `await expect(${locator}).toHaveCount(${e.count});${tag}`,
                ];
            }
            const locator =
                e.match === 'contains'
                    ? `${base}.getByRole(${q(e.role)}, {name: /${e.name}/})`
                    : `${base}.getByRole(${q(e.role)}, {name: ${q(e.name)}, exact: true})`;
            return [`await expect(${locator}).toHaveCount(0);${tag}`];
        }
    }
    return stop(`${p.id}: unknown expectation kind`);
}

function predicateLines(charter: Charter, p: Predicate, state: SessionState, scopes: Map<string, string>): string[] {
    return [
        '',
        `// * Predicate ${p.id}: declared (charter ${charter.feature_id} expected_outcome.${p.id}), discovered state ${state.id}`,
        ...ordered(p).flatMap((e) => expectationCode(charter, p, e, scopes)),
    ];
}

function gotoLine(pathname: string): string {
    const channel = /^\/([^/]+)\/channels\/([^/]+)$/.exec(pathname);
    return channel
        ? `await channelsPage.goto(${q(channel[1])}, ${q(channel[2])});`
        : `await page.goto(${q(pathname)});`;
}

function smokeLines(n: number, changes: string[]): string[] {
    return changes
        .map((c) => /^(region|dialog|alertdialog) "(.*)" appeared$/.exec(c))
        .filter((m): m is RegExpExecArray => Boolean(m))
        .map(
            (m) =>
                `await expect(page.getByRole(${q(m[1])}, {name: ${q(m[2].replace(/\\(.)/g, '$1'))}, exact: true})).toBeVisible(); // smoke: observed transition #${n} (${m[1]} "${m[2]}" appeared)`,
        );
}

function wrap(text: string, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
        if (line && line.length + word.length + 1 > width) {
            lines.push(line);
            line = word;
        } else {
            line = line ? `${line} ${word}` : word;
        }
    }
    return line ? [...lines, line] : lines;
}

type Body = {lines: string[]; scopes: Map<string, string>; steps: string[]};

/** Builds the test body from the selected discovered path and the declared predicates, or stops. */
function plan(charter: Charter, trace: SessionTrace): Body {
    if (JSON.stringify(trace.allowlist) !== JSON.stringify(charterAllowlist(charter))) {
        stop('trace allowlist differs from the charter allowed_actions; re-run explore');
    }
    if (JSON.stringify(trace.budget.limits) !== JSON.stringify(charterBudget(charter))) {
        stop('trace budget differs from the charter budget; re-run explore');
    }
    if (trace.start.path !== charter.start.start_path) {
        stop('trace start path differs from charter.start.start_path; re-run explore');
    }
    if (trace.guard.violations.length > 0) {
        stop(`exploration recorded ${trace.guard.violations.length} network guard violations`);
    }
    const ev = evaluateCharter(charter, trace.states, trace.start.state);
    if (ev.problems.length > 0) {
        stop(`charter problems: ${ev.problems.join('; ')}`);
    }
    if (ev.nameMismatches.length > 0) {
        stop(`live accessible names differ from the declared titles (not adapted): ${ev.nameMismatches.join('; ')}`);
    }
    if (!ev.selection) {
        const target = ev.predicates.find((p) => !p.appliesToStart);
        stop(
            `no discovered state qualifies for ${target?.id}; explored ${trace.states.length} states with ${trace.budget.used.actions} actions (see the predicate evaluation in trace.md)`,
        );
    }

    const start = trace.states.find((s) => s.id === trace.start.state);
    if (!start) {
        stop(`start state ${trace.start.state} is not in the trace`);
    }
    const startPredicates = ev.predicates.filter((p) => p.appliesToStart);
    for (const p of startPredicates) {
        if (!p.qualifying.includes(start.id)) {
            stop(`start state ${start.id} does not qualify for ${p.id}`);
        }
    }

    const scopes = new Map<string, string>();
    const steps: string[] = [`navigate ${charter.start.start_path} (charter start.start_path) -> state ${start.id}`];
    const lines: string[] = [
        `// # Go to ${charter.start.start_path} (charter start.start_path, exploration start state ${start.id})`,
        gotoLine(charter.start.start_path),
    ];
    for (const p of startPredicates) {
        lines.push(
            ...predicateLines(
                charter,
                charter.expected_outcome.find((x) => x.id === p.id)!,
                start,
                scopes,
            ),
        );
    }

    const target = trace.states.find((s) => s.id === ev.selection!.state)!;
    const allow = charterAllowlist(charter);
    let current = start;
    target.viaTransitions.forEach((n, i) => {
        const t = trace.transitions.find((x) => x.n === n);
        const action = target.via[i];
        if (!t || t.from !== current.id || t.action.role !== action.role || t.action.name !== action.name) {
            stop(
                `selected path step ${i + 1} has no matching recorded transition from state ${current.id}; a step would have to be invented`,
            );
        }
        if (!allow.some((a) => a.role === t.action.role && a.name === t.action.name)) {
            stop(`transition #${n} uses ${describe(t.action)}, which is not in allowed_actions`);
        }
        if (!current.candidates.some((c) => c.role === t.action.role && c.name === t.action.name)) {
            stop(`transition #${n}: ${describe(t.action)} was not a unique exact candidate in state ${current.id}`);
        }
        if (!t.sameDocument) {
            stop(`transition #${n} loaded a new document (reload)`);
        }
        const next = trace.states.find((s) => s.id === t.to);
        if (!next) {
            stop(`transition #${n} leads to unrecorded state ${t.to}`);
        }
        const effects = t.changes.filter((c) => /^(?:region|dialog|alertdialog) .*appeared$|^URL path/.test(c));
        lines.push(
            '',
            `// # Click ${describe(t.action)} (discovered: trace #${t.n}, ${effects.join(', ') || t.changes.join(', ')})`,
            `await page.getByRole(${q(t.action.role)}, {name: ${q(t.action.name)}, exact: true}).click();`,
            ...smokeLines(t.n, t.changes),
        );
        steps.push(`trace #${t.n}: click ${describe(t.action)} from state ${current.id} -> state ${next.id}`);
        current = next;
    });
    if (current.id !== target.id) {
        stop(`walking the selected path ended at ${current.id}, not ${target.id}`);
    }
    const targetPredicate = charter.expected_outcome.find((x) => x.id === ev.selection!.predicate)!;
    lines.push(...predicateLines(charter, targetPredicate, target, scopes));
    return {lines, scopes, steps};
}

function render(charter: Charter, session: string, body: Body, importPath: string): string {
    const scopeLines = [...body.scopes.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([scope, testid]) => `const ${camel(scope)} = page.getByTestId(${q(testid)});`);
    const code = [...scopeLines, '', ...body.lines].map((l) => (l ? `        ${l}` : '')).join('\n');
    const objective = wrap(`@objective ${charter.charter}`, 110).map((l) => ` * ${l}`);
    const title = `${charter.dedupe.key}: ${charter.expected_outcome.map((p) => p.id).join(' then ')}`;
    return `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Generated by explorer-proto/src/emit_session.ts from trace.json (discovered actions and locators) and
// sessions/${session}/charter.json (declared assertions). Do not edit by hand; re-run explore + emit --session=${session}.
// No pw.skipIfNoLicense() on purpose: this feature is licence-gated, but for this charter an unlicensed server is a
// setup failure, not a skip. Without a licence the declared bar assertions fail instead of being reported as skipped.

import {expect, test} from '@mattermost/playwright-lib';

import {closeGuardedSessions, openGuardedSession} from '${importPath}';

test.afterEach(closeGuardedSessions);

/**
${objective.join('\n')}
 * Hard expects only: a failing declared assertion stops the test at that line.
 */
test(${q(title)}, {tag: ['@channels', '@channel_bookmarks', '@explorer_session']}, async ({pw}) => {
        const {page, channelsPage} = await openGuardedSession(pw);
${code}
});
`;
}

export async function emitSession(session: string, dir: string): Promise<SessionEmission> {
    const prettierOptions = await prettier.resolveConfig(path.join(PLAYWRIGHT_DIR, 'playwright.config.ts'));
    if (!prettierOptions) {
        throw new Error('e2e-tests/playwright Prettier config not found.');
    }
    const charter = readCharter(session);
    const trace = readSessionTrace(dir);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.spec.ts'))) {
        fs.rmSync(path.join(dir, file));
    }

    let emission: SessionEmission;
    const dedupe = dedupeStatus(charter);
    const dedupeReason = `dedupe key ${charter.dedupe.key}: ${dedupe.status}`;
    if (dedupe.covered) {
        emission = {status: 'deduped', reasons: [`deduped: ${dedupeReason}`], steps: []};
    } else {
        try {
            const body = plan(charter, trace);
            const file = `${specStem(charter)}.spec.ts`;
            const importPath = path.relative(dir, path.join(SRC_DIR, 'session')).split(path.sep).join('/');
            const source = await prettier.format(render(charter, session, body, importPath), {
                ...prettierOptions,
                parser: 'typescript',
            });
            assertSanitized(file, source);
            fs.writeFileSync(path.join(dir, file), source);
            emission = {
                status: 'emitted',
                file,
                reasons: [
                    `${dedupeReason} -> emitted`,
                    'discovered paths are unique per state (states deduped by URL path + normalized snapshot); one spec per charter',
                ],
                steps: body.steps,
            };
        } catch (error) {
            if (!(error instanceof Stop)) {
                throw error;
            }
            emission = {status: 'stopped', reasons: [`${dedupeReason}`, `STOP: ${error.message}`], steps: []};
        }
    }

    writeSessionTrace(dir, {
        ...trace,
        evaluation: evaluateCharter(charter, trace.states, trace.start.state),
        emission,
    });
    return emission;
}
