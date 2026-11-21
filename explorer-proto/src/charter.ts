// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import {matchesName} from './assertions.ts';
import type {NameMatch} from './assertions.ts';
import type {Budget} from './bfs.ts';
import {COVERAGE_PATH, SESSIONS_DIR} from './paths.ts';
import {compareRoleName, compareStrings, describe, parseSnapshot, printable, stripGlyphs, walk} from './snapshot.ts';
import type {RoleName} from './snapshot.ts';

export const CHARTER_SCHEMA = 'explorer-session-charter/v1';

export type Expectation =
    | {id: string; kind: 'url_path'; equals: string}
    | {id: string; kind: 'testid'; testid: string; visible?: boolean}
    | {
          id: string;
          kind: 'role';
          role: string;
          name: string;
          match: NameMatch;
          scope: string;
          visible?: boolean;
          count: number;
      };

export type Predicate = {id: string; applies_to: string; expect: Expectation[]};

export type Charter = {
    schema: string;
    feature_id: string;
    charter: string;
    start: {team: string; user: string; start_path: string};
    allowed_actions: Array<RoleName & {exact: boolean}>;
    budget: {max_actions: number; max_depth: number; max_states: number};
    locator_scope: Record<string, string>;
    name_match_rules: Record<string, string>;
    expected_outcome: Predicate[];
    dedupe: {key: string};
};

export function charterPath(session: string): string {
    return path.join(SESSIONS_DIR, session, 'charter.json');
}

export function readCharter(session: string): Charter {
    const charter = JSON.parse(fs.readFileSync(charterPath(session), 'utf-8')) as Charter;
    if (charter.schema !== CHARTER_SCHEMA) {
        throw new Error(`Unsupported charter schema: ${charter.schema}`);
    }
    if (!/^\/\S+$/.test(charter.start?.start_path ?? '')) {
        throw new Error('charter.start.start_path must be an absolute path.');
    }
    return charter;
}

/** allowed_actions is an unordered set: exact entries only, deduplicated and sorted by role, then name. */
export function charterAllowlist(charter: Charter): RoleName[] {
    const seen = new Map<string, RoleName>();
    for (const a of charter.allowed_actions) {
        if (a.exact !== true) {
            throw new Error(`charter allowed action ${describe(a)} must be exact.`);
        }
        seen.set(JSON.stringify([a.role, a.name]), {role: a.role, name: a.name});
    }
    return [...seen.values()].sort(compareRoleName);
}

export function charterBudget(charter: Charter): Budget {
    const {max_actions: maxActions, max_depth: maxDepth, max_states: maxStates} = charter.budget;
    for (const [key, value] of Object.entries({maxActions, maxDepth, maxStates})) {
        if (!Number.isInteger(value) || value < 1) {
            throw new Error(`charter budget ${key} must be a positive integer.`);
        }
    }
    return {maxActions, maxDepth, maxStates};
}

/** File name stem from the dedupe key, e.g. channels.bookmarks:bar-follows-switch -> channels_bookmarks_bar_follows_switch. */
export function specStem(charter: Charter): string {
    return charter.dedupe.key.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/** Ledger status of the charter dedupe key in coverage.md (read-only). */
export function dedupeStatus(charter: Charter): {covered: boolean; status: string} {
    const lines = fs
        .readFileSync(COVERAGE_PATH, 'utf-8')
        .split('\n')
        .filter((l) => l.includes(charter.dedupe.key));
    if (lines.some((l) => /\bCOVERED\b/.test(l) && !/\bNOT COVERED\b/i.test(l))) {
        return {covered: true, status: 'marked COVERED in the ledger'};
    }
    return {
        covered: false,
        status: lines.length
            ? 'present in the ledger but not marked COVERED'
            : 'not marked covered (absent from the ledger)',
    };
}

export type Watch = {roles: string[]; substrings: string[]};

/**
 * What the explorer must report live (locator_scope.live_name_status): nodes whose role is one of the declared
 * role expectations and whose name contains one of the single-quoted substrings of live_name_status.
 */
export function charterWatch(charter: Charter): Watch {
    const status = charter.locator_scope?.live_name_status ?? '';
    const substrings = [...status.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort(compareStrings);
    if (substrings.length === 0) {
        throw new Error('charter locator_scope.live_name_status names no quoted substring to report.');
    }
    const roles = [
        ...new Set(
            roleExpectations(charter)
                .filter((e) => substrings.some((s) => e.name.includes(s)))
                .map((e) => e.role),
        ),
    ].sort(compareStrings);
    if (roles.length === 0) {
        throw new Error('No declared role expectation name contains a live_name_status substring.');
    }
    return {roles, substrings};
}

export type WatchedName = {role: string; name: string; count: number};

export function watchedNames(snapshot: string, watch: Watch): WatchedName[] {
    const counts = new Map<string, number>();
    walk(parseSnapshot(snapshot), (n) => {
        if (n.name === null || !watch.roles.includes(n.role)) {
            return;
        }
        const plain = stripGlyphs(n.name);
        if (watch.substrings.some((s) => n.name!.includes(s) || plain.includes(s))) {
            const key = JSON.stringify([n.role, n.name]);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    });
    return [...counts.entries()]
        .map(([key, count]) => {
            const [role, name] = JSON.parse(key) as [string, string];
            return {role, name, count};
        })
        .sort(compareRoleName);
}

function roleExpectations(charter: Charter) {
    return charter.expected_outcome.flatMap((p) =>
        p.expect.filter((e): e is Extract<Expectation, {kind: 'role'}> => e.kind === 'role'),
    );
}

export type EvalState = {
    id: string;
    depth: number;
    pathname: string;
    via: RoleName[];
    viaTransitions: number[];
    sameDocument: boolean;
    snapshot: string;
    watched: WatchedName[];
};

export type ExpectationResult = {id: string; status: 'pass' | 'fail' | 'not snapshot-observable'; detail: string};

export type StateResult = {
    state: string;
    pathname: string;
    path: string[];
    applies: boolean;
    appliesDetail: string;
    expectations: ExpectationResult[];
    qualifies: boolean;
};

export type PredicateEvaluation = {
    id: string;
    appliesToStart: boolean;
    urlPath: string;
    requiresSameDocument: boolean;
    results: StateResult[];
    qualifying: string[];
};

export type Evaluation = {
    problems: string[];
    nameMismatches: string[];
    predicates: PredicateEvaluation[];
    selection: {predicate: string; state: string; path: string[]; rule: string; candidates: string[]} | null;
};

export const SELECTION_RULE =
    'fewest actions, then the lexicographically smallest action sequence (per step: name, then role; code-unit order)';

/** Validates the declared expectations; returns problems that must stop emission. */
export function charterProblems(charter: Charter): string[] {
    const problems: string[] = [];
    const ids = new Set<string>();
    if (!charter.dedupe?.key) {
        problems.push('charter dedupe.key is missing');
    }
    for (const p of charter.expected_outcome ?? []) {
        if (!p.id) {
            problems.push('an expected_outcome predicate has no id');
        }
        for (const e of p.expect ?? []) {
            if (!e.id) {
                problems.push(`predicate ${p.id}: an expectation has no id`);
            } else if (ids.has(e.id)) {
                problems.push(`expectation id ${e.id} is declared twice`);
            }
            ids.add(e.id);
            if (e.kind === 'role') {
                if (e.match !== 'exact' && e.count !== 0) {
                    problems.push(`${p.id}/${e.id}: non-exact (${e.match}) name for a presence check is not allowed`);
                }
                if (e.match === 'contains' && !/^[\w ]+$/.test(e.name)) {
                    problems.push(`${p.id}/${e.id}: substring name must be plain letters, digits and spaces`);
                }
                if (e.match !== 'exact' && e.match !== 'contains') {
                    problems.push(`${p.id}/${e.id}: unknown match ${String(e.match)}`);
                }
                if (!Number.isInteger(e.count) || e.count < 0) {
                    problems.push(`${p.id}/${e.id}: count must be a non-negative integer`);
                }
                if (e.scope !== 'page' && !scopeTestid(charter, p, e.scope)) {
                    problems.push(`${p.id}/${e.id}: scope ${e.scope} has no matching testid expectation`);
                }
            } else if (e.kind !== 'url_path' && e.kind !== 'testid') {
                problems.push(`${p.id}/${(e as {id: string}).id}: unknown expectation kind`);
            }
        }
        if (p.expect.filter((e) => e.kind === 'url_path').length !== 1) {
            problems.push(`predicate ${p.id}: needs exactly one url_path expectation`);
        }
    }
    if ((charter.expected_outcome ?? []).length === 0) {
        problems.push('charter has no expected_outcome predicates');
    }
    return problems;
}

/** The predicate's testid for a non-page scope, cross-checked against the locator_scope description. */
export function scopeTestid(charter: Charter, p: Predicate, scope: string): string | null {
    const testids = p.expect.filter((e): e is Extract<Expectation, {kind: 'testid'}> => e.kind === 'testid');
    const described = charter.locator_scope?.[scope] ?? '';
    const match = testids.filter((t) => described.includes(`getByTestId('${t.testid}')`));
    return match.length === 1 ? match[0].testid : null;
}

function countMatching(snapshot: string, role: string, name: string, match: NameMatch): number {
    let n = 0;
    walk(parseSnapshot(snapshot), (node) => {
        if (node.role === role && node.name !== null && matchesName(node.name, {name, match})) {
            n++;
        }
    });
    return n;
}

function appliesTo(p: Predicate, urlPath: string) {
    const declaredPath = /URL path equals (\/\S+?)\.?(?:\s|$)/.exec(p.applies_to)?.[1];
    return {
        declaredPath,
        appliesToStart: /^the start state\b/i.test(p.applies_to.trim()),
        requiresSameDocument: /\bno page reload\b/i.test(p.applies_to),
        ok: declaredPath === urlPath,
    };
}

export function pathLabel(state: EvalState): string[] {
    return state.via.map((a, i) => `#${state.viaTransitions[i]} click ${describe(a)}`);
}

function comparePaths(a: EvalState, b: EvalState): number {
    if (a.via.length !== b.via.length) {
        return a.via.length - b.via.length;
    }
    for (let i = 0; i < a.via.length; i++) {
        const c = compareStrings(a.via[i].name, b.via[i].name) || compareStrings(a.via[i].role, b.via[i].role);
        if (c) {
            return c;
        }
    }
    return compareStrings(a.id, b.id);
}

/**
 * Evaluates every predicate against the discovered states. Expected values come only from the charter;
 * the snapshot only decides whether a state qualifies.
 */
export function evaluateCharter(charter: Charter, states: EvalState[], startStateId: string): Evaluation {
    const problems = charterProblems(charter);
    const nameMismatches: string[] = [];
    const allow = charterAllowlist(charter);
    const start = states.find((s) => s.id === startStateId);
    const reachable = new Set(
        start ? states.filter((s) => s.id === startStateId || s.viaTransitions.length > 0).map((s) => s.id) : [],
    );
    if (!start) {
        problems.push(`start state ${startStateId} was not recorded`);
    }
    const predicates: PredicateEvaluation[] = [];

    for (const e of roleExpectations(charter).filter((x) => x.match === 'exact' && x.count > 0)) {
        for (const s of states) {
            for (const w of s.watched.filter((x) => x.role === e.role && x.name !== e.name)) {
                if (w.name.includes(e.name) || stripGlyphs(w.name) === e.name) {
                    nameMismatches.push(
                        `${e.id}: live name "${printable(w.name)}" in state ${s.id} differs from declared exact "${e.name}"`,
                    );
                }
            }
        }
    }

    for (const p of charter.expected_outcome ?? []) {
        const url = p.expect.find((e): e is Extract<Expectation, {kind: 'url_path'}> => e.kind === 'url_path');
        const urlPath = url?.equals ?? '';
        const scope = appliesTo(p, urlPath);
        if (!scope.ok) {
            problems.push(
                `predicate ${p.id}: applies_to URL path ${scope.declaredPath ?? '(none)'} does not equal its url_path expectation ${urlPath}`,
            );
        }
        const results: StateResult[] = states.map((s) => {
            const reasons: string[] = [];
            if (s.pathname !== urlPath) {
                reasons.push(`URL path is ${s.pathname}, not ${urlPath}`);
            }
            if (scope.requiresSameDocument && !s.sameDocument) {
                reasons.push('reached with a page reload');
            }
            if (!s.via.every((a) => allow.some((x) => x.role === a.role && x.name === a.name))) {
                reasons.push('path uses an action outside allowed_actions');
            }
            if (!reachable.has(s.id)) {
                reasons.push('not reached from the start state');
            }
            const applies = reasons.length === 0;
            const appliesDetail = applies
                ? `URL path ${urlPath}${s.depth === 0 ? ' (start state)' : ''}, reached from the start state through allowed actions${scope.requiresSameDocument ? ' without reload' : ''}`
                : reasons.join('; ');
            const expectations: ExpectationResult[] = p.expect.map((e) => {
                if (e.kind === 'url_path') {
                    return s.pathname === e.equals
                        ? {id: e.id, status: 'pass', detail: `pathname ${s.pathname}`}
                        : {id: e.id, status: 'fail', detail: `pathname ${s.pathname}`};
                }
                if (e.kind === 'testid') {
                    return {
                        id: e.id,
                        status: 'not snapshot-observable',
                        detail: `testid ${e.testid} has no role, so no snapshot node; asserted by the replay locator`,
                    };
                }
                const n = countMatching(s.snapshot, e.role, e.name, e.match);
                const where =
                    e.scope === 'page' ? 'page-wide' : `page-wide (scope ${e.scope} is not snapshot-observable)`;
                return {
                    id: e.id,
                    status: n === e.count ? 'pass' : 'fail',
                    detail: `${e.role} with ${e.match} name "${e.name}": ${n} ${where}, declared count ${e.count}`,
                };
            });
            return {
                state: s.id,
                pathname: s.pathname,
                path: pathLabel(s),
                applies,
                appliesDetail,
                expectations,
                qualifies: applies && expectations.every((x) => x.status !== 'fail'),
            };
        });
        predicates.push({
            id: p.id,
            appliesToStart: scope.appliesToStart,
            urlPath,
            requiresSameDocument: scope.requiresSameDocument,
            results,
            qualifying: results.filter((r) => r.qualifies).map((r) => r.state),
        });
    }

    const targets = predicates.filter((p) => !p.appliesToStart);
    let selection: Evaluation['selection'] = null;
    if (targets.length === 1) {
        const target = targets[0];
        const candidates = states.filter((s) => target.qualifying.includes(s.id)).sort(comparePaths);
        if (candidates.length > 0) {
            selection = {
                predicate: target.id,
                state: candidates[0].id,
                path: pathLabel(candidates[0]),
                rule: SELECTION_RULE,
                candidates: candidates.map((c) => `${c.id}: ${pathLabel(c).join(' > ') || '(start)'}`),
            };
        }
    } else {
        problems.push(
            `expected exactly one predicate that is not asserted at the start state, found ${targets.length}; the step order would have to be invented`,
        );
    }
    return {problems, nameMismatches, predicates, selection};
}
