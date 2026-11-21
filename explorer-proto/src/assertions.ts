// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Control, Scenario} from './scenarios.ts';

export type NameMatch = 'exact' | 'contains';

/** One declared assertion parsed from scenarios.json expected_outcome. `scoped` = inside region "Info". */
export type Assertion =
    | {kind: 'url'; path: string}
    | {kind: 'visible'; role: string; name: string; scoped: boolean}
    | {kind: 'textVisible'; text: string}
    | {kind: 'count0'; role: string; name: string; match: NameMatch}
    | {kind: 'contains'; text: string; negated: boolean};

export type AbsenceAssertion = Extract<Assertion, {kind: 'count0'}>;

export const SCOPE = {role: 'region', name: 'Info'};

const ROLE_LOCATOR =
    /getByRole\('(\w+)', \{name: (?:'([^']+)', exact: true|\/([^/]+)\/)\}\) (is (?:still )?visible|has count 0)/g;

/** Parses one declared statement; throws on anything it does not understand rather than guessing. */
export function parseStatement(statement: string): Assertion[] {
    const scoped = /^(?:that )?region\b/.test(statement);
    const out: Assertion[] = [];
    const url = /^page URL pathname is (\/\S+)/.exec(statement);
    if (url) {
        out.push({kind: 'url', path: url[1]});
    }
    if (/^region '([^']+)' is visible/.test(statement)) {
        const name = /^region '([^']+)'/.exec(statement)![1];
        out.push({kind: 'visible', role: 'region', name, scoped: false});
    }
    for (const m of statement.matchAll(ROLE_LOCATOR)) {
        const [, role, exactName, substring, verb] = m;
        if (substring !== undefined) {
            // Substring names are only for absence checks, where a glyph prefix would make an exact name blind.
            if (verb !== 'has count 0' || !/^[\w ]+$/.test(substring)) {
                throw new Error(`Non-exact name allowed only as a plain-text absence check: ${statement}`);
            }
            out.push({kind: 'count0', role, name: substring, match: 'contains'});
        } else if (verb === 'has count 0') {
            out.push({kind: 'count0', role, name: exactName, match: 'exact'});
        } else {
            const isScope = role === SCOPE.role && exactName === SCOPE.name;
            out.push({kind: 'visible', role, name: exactName, scoped: scoped && !isScope});
        }
    }
    for (const m of statement.matchAll(/getByText\('([^']+)', \{exact: true\}\) is visible/g)) {
        out.push({kind: 'textVisible', text: m[1]});
    }
    for (const m of statement.matchAll(/(not\.)?toContainText '([^']+)'((?: and (?:not\.toContainText )?'[^']+')*)/g)) {
        const negated = Boolean(m[1]);
        out.push({kind: 'contains', text: m[2], negated});
        for (const more of m[3].matchAll(/ and (not\.toContainText )?'([^']+)'/g)) {
            out.push({kind: 'contains', text: more[2], negated: negated || Boolean(more[1])});
        }
    }
    if (out.length === 0) {
        throw new Error(`Unparsed declared statement: ${statement}`);
    }
    return out;
}

/** The scenario's assertion_locators entry for an absence check; its name_match must agree with the statement. */
export function absenceLocator(s: Scenario, a: AbsenceAssertion): Control {
    const entry = s.assertion_locators.find((l) => l.role === a.role && l.name === a.name);
    if (!entry) {
        throw new Error(`${s.id}: absence check ${a.role} "${a.name}" has no assertion_locators entry`);
    }
    const declared = entry.name_match ?? 'exact';
    if (declared !== a.match || (declared === 'contains') === entry.exact) {
        throw new Error(
            `${s.id}: ${a.role} "${a.name}" statement uses ${a.match} but assertion_locators says ${declared}`,
        );
    }
    return entry;
}

export function absenceAssertions(s: Scenario): AbsenceAssertion[] {
    return Object.entries(s.expected_outcome)
        .filter(([key]) => key !== 'independent_sources')
        .flatMap(([, statements]) => statements.flatMap(parseStatement))
        .filter((a): a is AbsenceAssertion => a.kind === 'count0');
}

export function matchesName(actual: string, a: {name: string; match: NameMatch}): boolean {
    return a.match === 'contains' ? actual.includes(a.name) : actual === a.name;
}

export function unconfirmedLabel(locator: {source_ref?: string; why?: string}): string {
    return `UNCONFIRMED-BY-LIVE (declared from source: ${locator.source_ref ?? locator.why})`;
}
