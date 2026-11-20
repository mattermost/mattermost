// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {test} from '@mattermost/playwright-lib';

import {summarize} from './guard.ts';
import type {GuardLedger} from './guard.ts';
import {outDir} from './paths.ts';
import {allowlist, readScenarios, startPath} from './scenarios.ts';
import {closeGuardedSession, closeGuardedSessions, openGuardedSession} from './session.ts';
import {
    INTERACTIVE_ROLES,
    classifyTransition,
    compareRoleName,
    describe,
    normalizeSnapshot,
    parseSnapshot,
    roleNameCounts,
    stateKey,
} from './snapshot.ts';
import type {RoleName} from './snapshot.ts';
import {TRACE_SCHEMA, writeTrace} from './trace.ts';
import type {Skipped, Trace, TraceState, TraceTransition} from './trace.ts';

const BUDGET = {maxActions: 12, maxDepth: 3, maxStates: 10};
const SETTLE_POLL_MS = 250;
const SETTLE_STABLE_POLLS = 4;
const SETTLE_TIMEOUT_MS = 20_000;

test.afterEach(closeGuardedSessions);

/** Waits until the normalized snapshot stops changing, then returns it with the pathname. */
async function settle(page: Page): Promise<{pathname: string; normalized: string}> {
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle', {timeout: 10_000}).catch(() => undefined);
    await page.mouse.move(0, 0);
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    let last = '';
    let stable = 0;
    for (;;) {
        const normalized = normalizeSnapshot(await page.locator('body').ariaSnapshot());
        stable = normalized === last ? stable + 1 : 0;
        last = normalized;
        if (stable >= SETTLE_STABLE_POLLS) {
            return {pathname: new URL(page.url()).pathname, normalized};
        }
        if (Date.now() > deadline) {
            throw new Error(`Snapshot did not settle on ${new URL(page.url()).pathname}`);
        }
        await page.waitForTimeout(SETTLE_POLL_MS);
    }
}

function same(a: RoleName, b: RoleName) {
    return a.role === b.role && a.name === b.name;
}

/** Splits the snapshot's interactive items into unique allowlisted candidates and skipped items. */
async function discoverCandidates(page: Page, normalized: string, allow: RoleName[]) {
    const roleNames = roleNameCounts(parseSnapshot(normalized));
    const candidates: RoleName[] = [];
    const skipped: Skipped[] = [];
    for (const item of roleNames.filter((rn) => INTERACTIVE_ROLES.has(rn.role))) {
        const rn = {role: item.role, name: item.name};
        if (!allow.some((a) => same(a, rn))) {
            const reason = item.count > 1 ? `not allowlisted; ambiguous: ${item.count} matches` : 'not allowlisted';
            skipped.push({...rn, reason});
            continue;
        }
        const count = await page.getByRole(rn.role as 'button', {name: rn.name, exact: true}).count();
        if (count === 1) {
            candidates.push(rn);
        } else {
            skipped.push({...rn, reason: `ambiguous: getByRole(..., {exact: true}).count() is ${count}`});
        }
    }
    const allowlistedAbsent = allow.filter((a) => !roleNames.some((rn) => same(a, rn)));
    return {candidates: candidates.sort(compareRoleName), skipped, allowlistedAbsent, roleNames};
}

test('explore Channel Info scenarios by bounded BFS over aria snapshots', async ({pw}) => {
    test.setTimeout(30 * 60_000);
    const scenarios = readScenarios();
    const allow = allowlist(scenarios).map(({role, name}) => ({role, name}));
    for (const a of allow) {
        if (normalizeSnapshot(`- ${a.role} "${a.name}"`) !== `- ${a.role} "${a.name}"`) {
            throw new Error(`Allowlisted name looks volatile and would not survive normalization: ${describe(a)}`);
        }
    }
    const roots = [...new Set(scenarios.map(startPath))].sort();

    const ledgers: GuardLedger[] = [];
    const states: TraceState[] = [];
    const byId = new Map<string, TraceState>();
    const transitions: TraceTransition[] = [];
    const budgetSkips: Trace['budgetSkips'] = [];
    const queue: TraceState[] = [];
    let actions = 0;

    // Every visit is a fresh guarded, signed-in context that replays the path from the root.
    const visit = async (root: string, via: RoleName[]) => {
        const session = await openGuardedSession(pw, 'exploration');
        ledgers.push(session.ledger);
        await session.page.goto(root);
        await settle(session.page);
        for (const step of via) {
            await session.page.getByRole(step.role as 'button', {name: step.name, exact: true}).click();
            await settle(session.page);
        }
        return session;
    };

    const record = async (
        page: Page,
        root: string,
        via: RoleName[],
        depth: number,
        observed: {pathname: string; normalized: string},
    ) => {
        const id = stateKey(observed.pathname, observed.normalized);
        const found = await discoverCandidates(page, observed.normalized, allow);
        const state: TraceState = {
            id,
            depth,
            root,
            pathname: observed.pathname,
            via,
            ...found,
            snapshot: observed.normalized,
        };
        states.push(state);
        byId.set(id, state);
        queue.push(state);
        return state;
    };

    for (const root of roots) {
        const session = await visit(root, []);
        const observed = await settle(session.page);
        if (!byId.has(stateKey(observed.pathname, observed.normalized))) {
            await record(session.page, root, [], 0, observed);
        }
        await closeGuardedSession(session);
    }

    while (queue.length > 0) {
        const state = queue.shift()!;
        for (const candidate of state.candidates) {
            if (state.depth >= BUDGET.maxDepth) {
                budgetSkips.push({from: state.id, action: candidate, reason: 'max depth'});
                continue;
            }
            if (actions >= BUDGET.maxActions) {
                budgetSkips.push({from: state.id, action: candidate, reason: 'max actions'});
                continue;
            }
            actions++;
            const session = await visit(state.root, state.via);
            const replayed = await settle(session.page);
            const replayKey = stateKey(replayed.pathname, replayed.normalized);

            await session.page.getByRole(candidate.role as 'button', {name: candidate.name, exact: true}).click();
            const after = await settle(session.page);
            const to = stateKey(after.pathname, after.normalized);
            const transition: TraceTransition = {
                n: actions,
                from: state.id,
                action: candidate,
                to,
                changes: classifyTransition({pathname: state.pathname, normalized: state.snapshot}, after),
            };
            const notes: string[] = [];
            if (replayKey !== state.id) {
                notes.push(`replay reached ${replayKey} instead of ${state.id}`);
            }
            if (to !== state.id && byId.has(to)) {
                const existing = byId.get(to)!;
                const route = existing.via.map((a) => `click ${describe(a)}`).join(' > ') || '(start)';
                notes.push(`deduped: state ${to} already reached from ${existing.root} via ${route}`);
            } else if (to !== state.id && states.length >= BUDGET.maxStates) {
                notes.push('skipped: budget (max states), state not recorded');
            } else if (to !== state.id) {
                await record(session.page, state.root, [...state.via, candidate], state.depth + 1, after);
            }
            if (notes.length) {
                transition.note = notes.join('; ');
            }
            transitions.push(transition);
            await closeGuardedSession(session);
        }
    }

    const blocked = ledgers.flatMap((l) => l.blocked);
    const trace: Trace = {
        schema: TRACE_SCHEMA,
        allowlist: allow,
        budget: {
            limits: BUDGET,
            used: {
                actions,
                states: states.length,
                deepest: Math.max(...states.map((s) => s.depth)),
                budgetSkips: budgetSkips.length,
            },
        },
        roots: roots.map((path) => ({path, state: states.find((s) => s.root === path && s.depth === 0)?.id ?? 'none'})),
        states,
        transitions,
        budgetSkips,
        guard: {
            blockedTotal: blocked.length,
            blocked: summarize(blocked),
            violations: ledgers.flatMap((l) => l.violations),
        },
    };
    writeTrace(outDir(), trace);
});
