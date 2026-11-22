// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {Locator, Page} from '@playwright/test';

import {resolveTemplate} from './journey_charter.ts';
import type {Bindings, JourneyCharter} from './journey_charter.ts';
import {CharterRuleError, parseGate, parseSettleMs, resolveScopes} from './journey_outcomes.ts';
import type {ClassClause} from './journey_outcomes.ts';
import {inlineText, occurrences, plainText, subtreeText, urlOk} from './journey_ui.ts';
import {parseSnapshot} from './snapshot.ts';
import type {SnapNode} from './snapshot.ts';

/**
 * Outcome-mode UI evaluation: per checkpoint, an optional gate (`evaluated_only_when`), an optional container
 * scope (`post_scope`) and a web-first settle window (`settle`). Strings are read from the raw aria snapshot
 * first; a string the snapshot lacks is looked up in the DOM (case-sensitive substring) and the method used is
 * recorded per string. Settling re-evaluates through Playwright's `expect.poll` on a fresh snapshot
 * until the checkpoint holds or the window ends; there is no fixed sleep.
 */

/** Roles that bound a scope container, smallest (deepest) first wins. */
export const SCOPE_CONTAINER_ROLES = [
    'listitem',
    'article',
    'row',
    'gridcell',
    'treeitem',
    'dialog',
    'alertdialog',
    'complementary',
    'region',
    'main',
] as const;

const SETTLE_INTERVALS_MS = [100, 250, 500];

export type EvidenceMethod = 'snapshot' | 'dom' | 'none';

export type ObservedClause = {desc: string; ok: boolean; string?: string; method?: EvidenceMethod};

export type SettleOutcome = 'not-evaluated' | 'no-settle' | 'true-immediately' | 'true-after-wait' | 'false-after-wait';

export type UiObservation = {
    id: string;
    evaluated: boolean;
    gate: string | null;
    ok: boolean | null;
    clauses: ObservedClause[];
    scope: string;
    settle: {limit_ms: number; outcome: SettleOutcome};
    /** Measured wall-clock wait; kept out of the deterministic log. */
    settleMsUsed: number;
};

type UiRules = {
    gates: Record<string, ClassClause | null>;
    settleMs: Record<string, number>;
    scopes: ReturnType<typeof resolveScopes>;
};

export function uiRules(charter: JourneyCharter): UiRules {
    const ids = charter.checkpoints.map((c) => c.id);
    const gates: UiRules['gates'] = {};
    const settleMs: UiRules['settleMs'] = {};
    for (const cp of charter.checkpoints.filter((c) => c.kind === 'ui')) {
        gates[cp.id] = parseGate(cp, ids);
        settleMs[cp.id] = parseSettleMs(cp);
    }
    return {gates, settleMs, scopes: resolveScopes(charter)};
}

function escapeRe(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ownText(node: SnapNode): string {
    return [node.name ?? '', inlineText(node)].join(' ');
}

/** Smallest container-role ancestor (or self) of every node whose own text holds the anchor, in document order. */
export function anchoredContainers(tree: SnapNode[], anchor: string): SnapNode[] {
    const out: SnapNode[] = [];
    const visit = (nodes: SnapNode[], ancestors: SnapNode[]) => {
        for (const n of nodes) {
            const chain = [...ancestors, n];
            if (ownText(n).includes(anchor)) {
                const container = [...chain]
                    .reverse()
                    .find((a) => (SCOPE_CONTAINER_ROLES as readonly string[]).includes(a.role));
                if (container && !out.includes(container)) {
                    out.push(container);
                }
            }
            visit(n.children, chain);
        }
    };
    visit(tree, []);
    return out;
}

function domContainers(page: Page, anchor: string): Locator {
    const anyRole = SCOPE_CONTAINER_ROLES.slice(1).reduce(
        (acc, role) => acc.or(page.getByRole(role)),
        page.getByRole(SCOPE_CONTAINER_ROLES[0]) as Locator,
    );
    const anchored = anyRole.filter({hasText: new RegExp(escapeRe(anchor))});
    return anchored.filter({hasNot: anyRole.filter({hasText: new RegExp(escapeRe(anchor))})});
}

type Scope =
    | {kind: 'page'; note: string}
    | {kind: 'snapshot'; nodes: SnapNode[]; dom: Locator; domCount: number; note: string}
    | {kind: 'dom'; dom: Locator; domCount: number; indexes: number[]; note: string};

type EvalOnce = {
    ok: boolean;
    clauses: ObservedClause[];
    scope: string;
    /** Indexes of the scope containers in which every clause held (for same-container dependents). */
    holding: number[];
};

async function textInDom(target: Locator, want: string): Promise<number> {
    return target
        .getByText(new RegExp(escapeRe(want)))
        .count()
        .catch(() => 0);
}

/** One evaluation of one checkpoint's clauses on one snapshot, inside each container of the scope. */
async function evalOnce(
    page: Page,
    cp: Record<string, unknown> & {id: string},
    bindings: Bindings,
    raw: string,
    pathname: string,
    scopeFor: (tree: SnapNode[]) => Promise<Scope>,
    restrictTo: number[] | null,
): Promise<EvalOnce> {
    const predicate = cp.predicate as Record<string, unknown>;
    const tree = parseSnapshot(raw);
    const clauses: ObservedClause[] = [];
    try {
        const url = urlOk(predicate, pathname, bindings);
        if (url) {
            clauses.push(url);
        }
    } catch (error) {
        if (error instanceof Error && /Unbound charter template/.test(error.message)) {
            return {
                ok: false,
                clauses: [{desc: 'url not evaluable yet (dependency unbound)', ok: false}],
                scope: 'n/a',
                holding: [],
            };
        }
        throw error;
    }

    const scope = await scopeFor(tree);
    const units: Array<{index: number; text: string | null; nodes: SnapNode[]; dom: Locator}> = [];
    if (scope.kind === 'page') {
        units.push({index: 0, text: plainText(tree), nodes: tree, dom: page.locator('body')});
    } else if (scope.kind === 'snapshot') {
        scope.nodes.forEach((node, i) => {
            const dom = scope.domCount === scope.nodes.length ? scope.dom.nth(i) : scope.dom;
            units.push({index: i, text: [node.name ?? '', subtreeText(node)].join(' '), nodes: [node], dom});
        });
    } else {
        for (const i of scope.indexes) {
            units.push({index: i, text: null, nodes: [], dom: scope.dom.nth(i)});
        }
    }
    const selected = restrictTo ? units.filter((u) => restrictTo.includes(u.index)) : units;

    const snapshot = predicate.snapshot as {all?: Array<Record<string, unknown>>} | undefined;
    const perUnit = new Map<number, ObservedClause[]>(selected.map((u) => [u.index, []]));
    const unbound: ObservedClause[] = [];
    for (const clause of snapshot?.all ?? []) {
        let want: string;
        try {
            want = resolveTemplate(
                String(clause.text_contains ?? clause.text ?? clause.name ?? clause.name_contains ?? ''),
                bindings,
            );
        } catch (error) {
            if (error instanceof Error && /Unbound charter template/.test(error.message)) {
                unbound.push({desc: 'clause not evaluable yet (dependency unbound)', ok: false});
                continue;
            }
            throw error;
        }
        for (const unit of selected) {
            let observed: ObservedClause;
            if ('text_contains' in clause || 'text' in clause) {
                const exact = 'text' in clause && !('text_contains' in clause);
                const atLeast = exact ? (clause.count as number) : ((clause.count_at_least as number | undefined) ?? 1);
                let n = unit.text === null ? 0 : occurrences(unit.text, want);
                let method: EvidenceMethod = unit.text === null ? 'dom' : 'snapshot';
                if (unit.text === null || (exact ? n !== atLeast : n < atLeast)) {
                    const domCount = await textInDom(unit.dom, want);
                    if (unit.text === null || domCount > n) {
                        n = Math.max(n, domCount);
                        method = 'dom';
                    }
                }
                const ok = exact ? n === atLeast : n >= atLeast;
                observed = {
                    desc: `${exact ? 'text' : 'text_contains'} "${want}" x${n} (${exact ? '==' : '>='} ${atLeast})`,
                    ok,
                    string: want,
                    method: ok ? method : 'none',
                };
            } else if ('role' in clause) {
                const role = clause.role as string;
                const name = clause.name ? want : null;
                const nameContains = clause.name_contains ? want : null;
                let count = 0;
                const walkCount = (nodes: SnapNode[]) => {
                    for (const n of nodes) {
                        if (
                            n.role === role &&
                            (name === null || n.name === name) &&
                            (nameContains === null || (n.name ?? '').includes(nameContains))
                        ) {
                            count++;
                        }
                        walkCount(n.children);
                    }
                };
                walkCount(unit.nodes);
                const exactCount = clause.count as number | undefined;
                const ok =
                    exactCount === undefined ? count >= ((clause.count_at_least as number) ?? 1) : count === exactCount;
                observed = {desc: `${role} "${name ?? nameContains ?? ''}" count ${count}`, ok, method: 'snapshot'};
            } else {
                throw new CharterRuleError(`${cp.id}: unsupported UI clause ${JSON.stringify(Object.keys(clause))}`);
            }
            perUnit.get(unit.index)!.push(observed);
        }
    }
    const urlOkAll = clauses.every((c) => c.ok);
    const unitOk = (i: number) => unbound.length === 0 && perUnit.get(i)!.every((c) => c.ok);
    const holding = selected.map((u) => u.index).filter(unitOk);
    // An owner holds when one container holds; a same-container dependent must hold in every container its owner held in.
    const ok =
        urlOkAll && (restrictTo ? selected.length > 0 && holding.length === selected.length : holding.length > 0);
    const failing = selected.map((u) => u.index).filter((i) => !unitOk(i));
    const mostOk = [...selected]
        .map((u) => u.index)
        .sort((a, b) => perUnit.get(b)!.filter((c) => c.ok).length - perUnit.get(a)!.filter((c) => c.ok).length)[0];
    const representative = restrictTo ? (failing[0] ?? holding[0]) : (holding[0] ?? mostOk);
    if (representative === undefined) {
        clauses.push({desc: 'no container in scope', ok: false, method: 'none'});
    } else {
        clauses.push(...perUnit.get(representative)!);
    }
    clauses.push(...unbound);
    const note =
        selected.length > 1 ? `${scope.note}; clauses reported for container #${representative + 1}` : scope.note;
    return {ok, clauses, scope: note, holding};
}

/**
 * Evaluates the charter's UI checkpoints for one reached state, in charter order. `results` carries this
 * observation's checkpoint values so later gates and same-container scopes can use them.
 */
export async function observeUi(
    page: Page,
    charter: JourneyCharter,
    rules: UiRules,
    bindings: Bindings,
    pathname: string,
    initialRaw: string,
    results: Record<string, boolean | undefined>,
): Promise<UiObservation[]> {
    const out: UiObservation[] = [];
    const holdingByOwner: Record<string, number[]> = {};
    let latestRaw = initialRaw;
    for (const cp of charter.checkpoints.filter((c) => c.kind === 'ui')) {
        const gate = rules.gates[cp.id];
        const limit = rules.settleMs[cp.id];
        const gateText = gate ? `${gate.checkpoint} is ${gate.value}` : null;
        if (gate && results[gate.checkpoint] !== gate.value) {
            out.push({
                id: cp.id,
                evaluated: false,
                gate: gateText,
                ok: null,
                clauses: [],
                scope: 'n/a',
                settle: {limit_ms: limit, outcome: 'not-evaluated'},
                settleMsUsed: 0,
            });
            continue;
        }
        const scopeSpec = rules.scopes[cp.id];
        let anchor: string | null = null;
        if (scopeSpec) {
            anchor = resolveTemplate(charter.fixture.fixed_strings?.[scopeSpec.anchorKey] ?? '', bindings);
        }
        const dependent = scopeSpec && scopeSpec.owner !== cp.id ? scopeSpec.owner : null;
        const restrictTo = dependent ? (holdingByOwner[dependent] ?? []) : null;
        const scopeFor = async (tree: SnapNode[]): Promise<Scope> => {
            if (!anchor) {
                return {kind: 'page', note: 'page-wide (no post_scope declared)'};
            }
            const nodes = anchoredContainers(tree, anchor);
            const dom = domContainers(page, anchor);
            const domCount = await dom.count().catch(() => 0);
            if (nodes.length > 0) {
                return {
                    kind: 'snapshot',
                    nodes,
                    dom,
                    domCount,
                    note: `post_scope: snapshot ${[...new Set(nodes.map((n) => n.role))].join('/')} container x${nodes.length} anchored on fixed_strings.${scopeSpec!.anchorKey}${dependent ? ` (same container as ${dependent})` : ''}${domCount === nodes.length ? '' : `; DOM fallback spans all ${domCount} anchored DOM container(s)`}`,
                };
            }
            if (domCount > 0) {
                return {
                    kind: 'dom',
                    dom,
                    domCount,
                    indexes: [...Array(domCount).keys()],
                    note: `post_scope: DOM container x${domCount} anchored on fixed_strings.${scopeSpec!.anchorKey}${dependent ? ` (same container as ${dependent})` : ''}`,
                };
            }
            return {kind: 'page', note: `page-wide (no container anchored on fixed_strings.${scopeSpec!.anchorKey})`};
        };

        const started = Date.now();
        let last = await evalOnce(page, cp, bindings, latestRaw, pathname, scopeFor, restrictTo);
        let outcome: SettleOutcome = limit > 0 ? 'true-immediately' : 'no-settle';
        if (!last.ok && limit > 0) {
            try {
                await expect
                    .poll(
                        async () => {
                            latestRaw = await page.locator('body').ariaSnapshot();
                            last = await evalOnce(page, cp, bindings, latestRaw, pathname, scopeFor, restrictTo);
                            return last.ok;
                        },
                        {timeout: limit, intervals: SETTLE_INTERVALS_MS},
                    )
                    .toBe(true);
            } catch {
                // The window ended; `last` holds the final evaluation.
            }
            outcome = last.ok ? 'true-after-wait' : 'false-after-wait';
        }
        if (!dependent) {
            holdingByOwner[cp.id] = last.holding;
        }
        results[cp.id] = last.ok;
        out.push({
            id: cp.id,
            evaluated: true,
            gate: gateText,
            ok: last.ok,
            clauses: last.clauses,
            scope: last.scope,
            settle: {limit_ms: limit, outcome},
            settleMsUsed: Date.now() - started,
        });
    }
    return out;
}
