// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import type {GuardLedger} from './guard.ts';
import {closeGuardedSession, openGuardedSession} from './session.ts';
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
import type {Skipped, Trace, TraceState, TraceTransition} from './trace.ts';

export type Budget = {maxActions: number; maxDepth: number; maxStates: number};

export type Observed = {pathname: string; normalized: string; raw: string};

/** Session-only extras: per-state path metadata and document-continuity tracking across clicks. */
export type SessionHooks = {
    /** Extra per-state fields computed from the live (un-normalized) snapshot. */
    observe: (raw: string) => Record<string, unknown>;
};

export type BfsState = TraceState & {viaTransitions?: number[]; sameDocument?: boolean} & Record<string, unknown>;
export type BfsTransition = TraceTransition & {sameDocument?: boolean};

export type BfsResult = {
    states: BfsState[];
    transitions: BfsTransition[];
    budgetSkips: Trace['budgetSkips'];
    ledgers: GuardLedger[];
    actions: number;
};

const SETTLE_POLL_MS = 250;
const SETTLE_STABLE_POLLS = 4;
const SETTLE_TIMEOUT_MS = 20_000;
const DOCUMENT_MARKER = '__explorerDocumentMarker';

/** Waits until the normalized snapshot stops changing, then returns it with the pathname. */
export async function settle(page: Page, normalize: (raw: string) => string = normalizeSnapshot): Promise<Observed> {
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle', {timeout: 10_000}).catch(() => undefined);
    await page.mouse.move(0, 0);
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    let last = '';
    let stable = 0;
    for (;;) {
        const raw = await page.locator('body').ariaSnapshot();
        const normalized = normalize(raw);
        stable = normalized === last ? stable + 1 : 0;
        last = normalized;
        if (stable >= SETTLE_STABLE_POLLS) {
            return {pathname: new URL(page.url()).pathname, normalized, raw};
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
export async function discoverCandidates(page: Page, normalized: string, allow: RoleName[]) {
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

export function assertStableAllowlist(allow: RoleName[]) {
    for (const a of allow) {
        if (normalizeSnapshot(`- ${a.role} "${a.name}"`) !== `- ${a.role} "${a.name}"`) {
            throw new Error(`Allowlisted name looks volatile and would not survive normalization: ${describe(a)}`);
        }
    }
}

async function markDocument(page: Page) {
    await page.evaluate((key) => {
        (window as unknown as Record<string, boolean>)[key] = true;
    }, DOCUMENT_MARKER);
}

async function sameDocument(page: Page): Promise<boolean> {
    return page.evaluate((key) => (window as unknown as Record<string, boolean>)[key] === true, DOCUMENT_MARKER);
}

/**
 * Bounded BFS over aria snapshots. Every visit is a fresh guarded, signed-in context that replays the path
 * from its root; states are keyed by pathname + normalized snapshot and deduped.
 */
export async function runBfs(
    pw: PlaywrightExtended,
    options: {
        roots: string[];
        allow: RoleName[];
        budget: Budget;
        normalize?: (raw: string) => string;
        session?: SessionHooks;
    },
): Promise<BfsResult> {
    const {roots, allow, budget, session} = options;
    const normalize = options.normalize ?? normalizeSnapshot;
    const ledgers: GuardLedger[] = [];
    const states: BfsState[] = [];
    const byId = new Map<string, BfsState>();
    const transitions: BfsTransition[] = [];
    const budgetSkips: Trace['budgetSkips'] = [];
    const queue: BfsState[] = [];
    let actions = 0;

    // With session hooks, a marker set on window after the root navigation shows whether later clicks kept the
    // same document (in-app navigation) or loaded a new one (reload).
    const visit = async (root: string, via: RoleName[]) => {
        const s = await openGuardedSession(pw, 'exploration');
        ledgers.push(s.ledger);
        await s.page.goto(root);
        await settle(s.page, normalize);
        if (session) {
            await markDocument(s.page);
        }
        for (const step of via) {
            await s.page.getByRole(step.role as 'button', {name: step.name, exact: true}).click();
            await settle(s.page, normalize);
        }
        return s;
    };

    const record = async (
        page: Page,
        root: string,
        via: RoleName[],
        depth: number,
        observed: Observed,
        parent?: {state: BfsState; transition: BfsTransition},
    ) => {
        const id = stateKey(observed.pathname, observed.normalized);
        const found = await discoverCandidates(page, observed.normalized, allow);
        const state: BfsState = {
            id,
            depth,
            root,
            pathname: observed.pathname,
            via,
            ...found,
            snapshot: observed.normalized,
        };
        if (session) {
            Object.assign(state, {
                viaTransitions: parent ? [...(parent.state.viaTransitions ?? []), parent.transition.n] : [],
                sameDocument: parent ? Boolean(parent.state.sameDocument && parent.transition.sameDocument) : true,
                ...session.observe(observed.raw),
            });
        }
        states.push(state);
        byId.set(id, state);
        queue.push(state);
        return state;
    };

    for (const root of roots) {
        const s = await visit(root, []);
        const observed = await settle(s.page, normalize);
        if (!byId.has(stateKey(observed.pathname, observed.normalized))) {
            await record(s.page, root, [], 0, observed);
        }
        await closeGuardedSession(s);
    }

    while (queue.length > 0) {
        const state = queue.shift()!;
        for (const candidate of state.candidates) {
            if (state.depth >= budget.maxDepth) {
                budgetSkips.push({from: state.id, action: candidate, reason: 'max depth'});
                continue;
            }
            if (actions >= budget.maxActions) {
                budgetSkips.push({from: state.id, action: candidate, reason: 'max actions'});
                continue;
            }
            actions++;
            const s = await visit(state.root, state.via);
            const replayed = await settle(s.page, normalize);
            const replayKey = stateKey(replayed.pathname, replayed.normalized);
            const replayKeptDocument = session ? await sameDocument(s.page) : true;

            await s.page.getByRole(candidate.role as 'button', {name: candidate.name, exact: true}).click();
            const after = await settle(s.page, normalize);
            const to = stateKey(after.pathname, after.normalized);
            const transition: BfsTransition = {
                n: actions,
                from: state.id,
                action: candidate,
                to,
                changes: classifyTransition({pathname: state.pathname, normalized: state.snapshot}, after),
            };
            if (session) {
                transition.sameDocument = await sameDocument(s.page);
            }
            const notes: string[] = [];
            if (replayKey !== state.id) {
                notes.push(`replay reached ${replayKey} instead of ${state.id}`);
            }
            if (!replayKeptDocument) {
                notes.push('path replay loaded a new document');
            }
            if (to !== state.id && byId.has(to)) {
                const existing = byId.get(to)!;
                const route = existing.via.map((a) => `click ${describe(a)}`).join(' > ') || '(start)';
                notes.push(`deduped: state ${to} already reached from ${existing.root} via ${route}`);
            } else if (to !== state.id && states.length >= budget.maxStates) {
                notes.push('skipped: budget (max states), state not recorded');
            } else if (to !== state.id) {
                await record(s.page, state.root, [...state.via, candidate], state.depth + 1, after, {
                    state,
                    transition,
                });
            }
            if (notes.length) {
                transition.note = notes.join('; ');
            }
            transitions.push(transition);
            await closeGuardedSession(s);
        }
    }

    return {states, transitions, budgetSkips, ledgers, actions};
}
