// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {JourneyCharter} from './journey_charter.ts';

/**
 * Outcome rules read from the charter (`success_criteria.outcomes`, `observation_policy`, checkpoint
 * `evaluated_only_when` / `settle` / `post_scope`). Nothing here names a checkpoint, class or verdict: every
 * name comes from the charter, and text the grammar below does not recognise is a charter error (fail closed).
 *
 * Grammar (case-insensitive, over the charter's own ids and class names):
 * - classification: each `<CHECKPOINT-ID> true|false` in a class's text is one clause; all must hold.
 * - run_verdict text: `every other case` -> always; `precondition` / `read-back` -> setup failure;
 *   `at least one reached state is <CLASS>` -> observed(CLASS), or confirmed(CLASS) when the text mentions
 *   confirmation; `no <CLASS> observation exists` -> none(CLASS). Conditions in one text are ANDed.
 * - precedence entry: `<VERDICT>` (its run_verdict rule) or `<VERDICT> when a[n] [un]confirmed <CLASS> exists`.
 */

export class CharterRuleError extends Error {}

export type ClassClause = {checkpoint: string; value: boolean};
export type ClassRule = {name: string; clauses: ClassClause[]};

export type Condition =
    {kind: 'always'} | {kind: 'setup'} | {kind: 'observed' | 'confirmed' | 'unconfirmed' | 'none'; cls: string};

export type VerdictRule = {verdict: string; label: string; conditions: Condition[]};

export type OutcomeRules = {
    classes: ClassRule[];
    precedence: VerdictRule[];
    /** Classes whose paths get confirmation replays, in confirmation order. */
    confirmOrder: string[];
    /** Classes copied to failing_observations. */
    preserveClasses: string[];
    noEarlyStop: boolean;
    reserved: number;
};

function escapeRe(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function alternation(names: string[]): string {
    return [...names]
        .sort((a, b) => b.length - a.length)
        .map(escapeRe)
        .join('|');
}

const BOUNDARY_BEFORE = '(?<![A-Za-z0-9_-])';
const BOUNDARY_AFTER = '(?![A-Za-z0-9_-])';

export function hasOutcomes(charter: JourneyCharter): boolean {
    return Boolean(charter.success_criteria?.outcomes);
}

export function parseClassClauses(text: string, checkpointIds: string[]): ClassClause[] {
    const re = new RegExp(
        `${BOUNDARY_BEFORE}(${alternation(checkpointIds)})${BOUNDARY_AFTER}\\s+(true|false)\\b`,
        'gi',
    );
    return [...text.matchAll(re)].map((m) => ({
        checkpoint: checkpointIds.find((id) => id.toLowerCase() === m[1].toLowerCase())!,
        value: m[2].toLowerCase() === 'true',
    }));
}

function classRe(classes: string[], flags = 'gi'): (prefix: string, suffix?: string) => RegExp {
    return (prefix, suffix = '') =>
        new RegExp(`${prefix}${BOUNDARY_BEFORE}(${alternation(classes)})${BOUNDARY_AFTER}${suffix}`, flags);
}

function canonical(classes: string[], found: string): string {
    return classes.find((c) => c.toLowerCase() === found.toLowerCase())!;
}

export function parseVerdictText(verdict: string, text: string, classes: string[]): Condition[] {
    if (/^\s*every other case\b/i.test(text)) {
        return [{kind: 'always'}];
    }
    const re = classRe(classes);
    const conditions: Condition[] = [];
    const confirms = /\bconfirm/i.test(text);
    for (const m of text.matchAll(re('\\bat least one reached state is\\s+'))) {
        conditions.push({kind: confirms ? 'confirmed' : 'observed', cls: canonical(classes, m[1])});
    }
    for (const m of text.matchAll(re('\\bno\\s+', '\\s+observations?\\s+exists?\\b'))) {
        conditions.push({kind: 'none', cls: canonical(classes, m[1])});
    }
    if (conditions.length === 0 && /\b(?:precondition|read-back)\b/i.test(text)) {
        conditions.push({kind: 'setup'});
    }
    if (conditions.length === 0) {
        throw new CharterRuleError(`run_verdict ${verdict}: no recognised condition`);
    }
    return conditions;
}

function parsePrecedenceEntry(entry: string, runVerdict: Record<string, string>, classes: string[]): VerdictRule {
    const bare = /^\s*([A-Z][A-Z0-9_]*)\s*$/.exec(entry);
    if (bare) {
        const text = runVerdict[bare[1]];
        if (text === undefined) {
            throw new CharterRuleError(`precedence names ${bare[1]}, which run_verdict does not define`);
        }
        return {verdict: bare[1], label: bare[1], conditions: parseVerdictText(bare[1], text, classes)};
    }
    const conditional = new RegExp(
        `^\\s*([A-Z][A-Z0-9_]*)\\s+when\\s+(?:an?\\s+)?(unconfirmed|confirmed)\\s+${BOUNDARY_BEFORE}(${alternation(classes)})${BOUNDARY_AFTER}\\s+(?:observation\\s+)?exists\\s*$`,
        'i',
    ).exec(entry);
    if (conditional) {
        if (runVerdict[conditional[1]] === undefined) {
            throw new CharterRuleError(`precedence names ${conditional[1]}, which run_verdict does not define`);
        }
        return {
            verdict: conditional[1],
            label: entry.trim(),
            conditions: [
                {
                    kind: conditional[2].toLowerCase() as 'confirmed' | 'unconfirmed',
                    cls: canonical(classes, conditional[3]),
                },
            ],
        };
    }
    throw new CharterRuleError(`precedence entry not recognised: ${entry}`);
}

export function parseOutcomeRules(charter: JourneyCharter): OutcomeRules {
    const outcomes = charter.success_criteria.outcomes;
    if (!outcomes) {
        throw new CharterRuleError('charter declares no success_criteria.outcomes');
    }
    const ids = charter.checkpoints.map((c) => c.id);
    const classes: ClassRule[] = Object.entries(outcomes.per_state_classification ?? {}).map(([name, text]) => {
        const clauses = parseClassClauses(text, ids);
        if (clauses.length === 0) {
            throw new CharterRuleError(`classification ${name}: no '<checkpoint> true|false' clause`);
        }
        return {name, clauses};
    });
    if (classes.length === 0) {
        throw new CharterRuleError('per_state_classification is empty');
    }
    const classNames = classes.map((c) => c.name);
    const precedence = (outcomes.precedence ?? []).map((e) =>
        parsePrecedenceEntry(e, outcomes.run_verdict ?? {}, classNames),
    );
    if (!precedence.length || !precedence[precedence.length - 1].conditions.some((c) => c.kind === 'always')) {
        throw new CharterRuleError('precedence must end with a verdict whose rule covers every other case');
    }
    const confirmOrder: string[] = [];
    for (const rule of precedence) {
        for (const c of rule.conditions) {
            if ((c.kind === 'confirmed' || c.kind === 'unconfirmed') && !confirmOrder.includes(c.cls)) {
                confirmOrder.push(c.cls);
            }
        }
    }
    const policy = charter.observation_policy ?? {};
    const preserveText = typeof policy.preserve_failures === 'string' ? policy.preserve_failures : '';
    const preserveClasses = classNames.filter((c) =>
        new RegExp(`${BOUNDARY_BEFORE}${escapeRe(c)}${BOUNDARY_AFTER}`).test(preserveText),
    );
    if (preserveClasses.length === 0) {
        for (const rule of precedence) {
            for (const c of rule.conditions) {
                if (c.kind === 'unconfirmed' && !preserveClasses.includes(c.cls)) {
                    preserveClasses.push(c.cls);
                }
            }
        }
    }
    return {
        classes,
        precedence,
        confirmOrder,
        preserveClasses,
        noEarlyStop: 'no_early_stop' in policy,
        reserved: charter.budget_reserve?.confirmation_replays_reserved ?? 0,
    };
}

export type Classification = {cls: string | null; matched: string[]};

/** First declared class whose clauses all hold; a checkpoint that was not evaluated matches no clause. */
export function classify(rules: OutcomeRules, results: Record<string, boolean | undefined>): Classification {
    const matched = rules.classes
        .filter((rule) => rule.clauses.every((c) => results[c.checkpoint] === c.value))
        .map((r) => r.name);
    return {cls: matched[0] ?? null, matched};
}

export type VerdictInput = {
    setupFailed: boolean;
    /** Every classified observation (state level), in log order. */
    classified: Array<{pathKey: string; cls: string}>;
    /** Confirmation results keyed by `${cls}\u0000${pathKey}`; absent means not attempted. */
    confirmations: Map<string, boolean>;
};

export function confirmationKey(cls: string, pathKey: string): string {
    return `${cls}\u0000${pathKey}`;
}

function holds(c: Condition, input: VerdictInput): boolean {
    switch (c.kind) {
        case 'always':
            return true;
        case 'setup':
            return input.setupFailed;
        case 'observed':
            return input.classified.some((o) => o.cls === c.cls);
        case 'none':
            return !input.classified.some((o) => o.cls === c.cls);
        case 'confirmed':
            return input.classified.some(
                (o) => o.cls === c.cls && input.confirmations.get(confirmationKey(c.cls, o.pathKey)) === true,
            );
        case 'unconfirmed':
            return input.classified.some(
                (o) => o.cls === c.cls && input.confirmations.get(confirmationKey(c.cls, o.pathKey)) !== true,
            );
        default:
            return false;
    }
}

/** First precedence entry whose conditions all hold. */
export function decideVerdict(rules: OutcomeRules, input: VerdictInput): {verdict: string; rule: string} {
    for (const rule of rules.precedence) {
        if (rule.conditions.every((c) => holds(c, input))) {
            return {verdict: rule.verdict, rule: rule.label};
        }
    }
    throw new CharterRuleError('no precedence entry holds');
}

/** `evaluated_only_when: "<ID> is true|false ..."` -> the gate, or null when the checkpoint is always evaluated. */
export function parseGate(cp: Record<string, unknown>, checkpointIds: string[]): ClassClause | null {
    const predicate = (cp.predicate ?? {}) as Record<string, unknown>;
    const text = predicate.evaluated_only_when;
    if (typeof text !== 'string') {
        return null;
    }
    const m = new RegExp(
        `${BOUNDARY_BEFORE}(${alternation(checkpointIds)})${BOUNDARY_AFTER}\\s+is\\s+(true|false)\\b`,
        'i',
    ).exec(text);
    if (!m) {
        throw new CharterRuleError(`${String(cp.id)}: evaluated_only_when names no '<checkpoint> is true|false'`);
    }
    return {
        checkpoint: checkpointIds.find((id) => id.toLowerCase() === m[1].toLowerCase())!,
        value: m[2].toLowerCase() === 'true',
    };
}

/** Settle window in ms: `settle.ms` / `settle.timeout_ms`, else `up to <n> ms` in `settle.rule`; 0 without settle. */
export function parseSettleMs(cp: Record<string, unknown>): number {
    const predicate = (cp.predicate ?? {}) as Record<string, unknown>;
    const settle = predicate.settle as Record<string, unknown> | undefined;
    if (!settle) {
        return 0;
    }
    for (const key of ['ms', 'timeout_ms']) {
        if (Number.isInteger(settle[key]) && (settle[key] as number) >= 0) {
            return settle[key] as number;
        }
    }
    const m = /\bup to\s+(\d+)\s*ms\b/i.exec(String(settle.rule ?? ''));
    if (!m) {
        throw new CharterRuleError(`${String(cp.id)}: settle declares no window ('ms' or 'up to <n> ms')`);
    }
    return Number(m[1]);
}

export type ScopeSpec = {anchorKey: string} | {sameAs: string} | null;

/**
 * post_scope: `anchor` (a fixed_strings key or its `{fixture.fixed_strings.<key>}` template), `same_as`, or the
 * rule text: `same container as <ID>`, else the fixed_strings key named after `contains`, else the only one named.
 */
export function parseScope(cp: Record<string, unknown>, charter: JourneyCharter): ScopeSpec {
    const predicate = (cp.predicate ?? {}) as Record<string, unknown>;
    const scope = predicate.post_scope as Record<string, unknown> | undefined;
    if (!scope) {
        return null;
    }
    const keys = Object.keys(charter.fixture.fixed_strings ?? {});
    const ids = charter.checkpoints.map((c) => c.id);
    const keyOf = (text: string) => /^\{?(?:fixture\.fixed_strings\.)?([A-Za-z0-9_]+)\}?$/.exec(text.trim())?.[1];
    if (typeof scope.anchor === 'string') {
        const key = keyOf(scope.anchor);
        if (!key || !keys.includes(key)) {
            throw new CharterRuleError(`${String(cp.id)}: post_scope.anchor is not a fixed_strings key`);
        }
        return {anchorKey: key};
    }
    if (typeof scope.same_as === 'string' && ids.includes(scope.same_as)) {
        return {sameAs: scope.same_as};
    }
    const rule = String(scope.rule ?? '');
    const same = new RegExp(
        `\\bsame container as\\s+${BOUNDARY_BEFORE}(${alternation(ids)})${BOUNDARY_AFTER}`,
        'i',
    ).exec(rule);
    if (same) {
        return {sameAs: ids.find((id) => id.toLowerCase() === same[1].toLowerCase())!};
    }
    const keyRe = alternation(keys);
    if (keys.length) {
        const after = new RegExp(`\\bcontains\\s+\\{?(?:fixture\\.fixed_strings\\.)?(${keyRe})\\b`).exec(rule);
        if (after) {
            return {anchorKey: after[1]};
        }
        const named = keys.filter((k) => new RegExp(`(?<![A-Za-z0-9_])${escapeRe(k)}(?![A-Za-z0-9_])`).test(rule));
        if (named.length === 1) {
            return {anchorKey: named[0]};
        }
    }
    throw new CharterRuleError(`${String(cp.id)}: post_scope names no anchor`);
}

/** Resolves `sameAs` chains to the anchoring checkpoint id and its fixed_strings key. */
export function resolveScopes(charter: JourneyCharter): Record<string, {anchorKey: string; owner: string} | null> {
    const raw: Record<string, ScopeSpec> = {};
    for (const cp of charter.checkpoints.filter((c) => c.kind === 'ui')) {
        raw[cp.id] = parseScope(cp, charter);
    }
    const out: Record<string, {anchorKey: string; owner: string} | null> = {};
    for (const id of Object.keys(raw)) {
        let cur = id;
        const seen = new Set<string>();
        let spec = raw[cur];
        while (spec && 'sameAs' in spec) {
            if (seen.has(cur) || !(spec.sameAs in raw)) {
                throw new CharterRuleError(`${id}: post_scope same-container chain does not end at an anchor`);
            }
            seen.add(cur);
            cur = spec.sameAs;
            spec = raw[cur];
        }
        out[id] = spec ? {anchorKey: spec.anchorKey, owner: cur} : null;
    }
    return out;
}

/** Validates every outcome-mode rule up front so a charter error stops the run before any fixture is built. */
export function validateOutcomeCharter(charter: JourneyCharter): OutcomeRules {
    const rules = parseOutcomeRules(charter);
    const ids = charter.checkpoints.map((c) => c.id);
    for (const cp of charter.checkpoints) {
        parseGate(cp, ids);
        if (cp.kind === 'ui') {
            parseSettleMs(cp);
        }
    }
    resolveScopes(charter);
    return rules;
}
