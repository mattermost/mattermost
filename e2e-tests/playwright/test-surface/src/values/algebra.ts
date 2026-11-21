// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Arm, Gap, Part, Unresolved, Value} from './types.ts';

import {KEY_PLACEHOLDER} from '../grammar.ts';
import {MAX_TEMPLATE_VALUES, MAX_USAGE_VALUES} from '../limits.ts';
import {type Loc} from '../program_index.ts';

export const lit = (s: string, via?: Loc[], primitive?: 'number' | 'boolean'): Value => ({k: 'lit', s, ...(via ? {via} : {}), ...(primitive ? {primitive} : {})});

/** Why a value stands for the ones left out past a cap: what was kept is only part of what the expression can be. */
export const TOO_MANY_VALUES = 'too-many-values';

/** The values past a cap, which `concat` leaves out: never silently, so checks can say the set is incomplete. */
export const truncated = (at = ''): Unresolved => ({k: 'unres', why: TOO_MANY_VALUES, at});

export const isTruncated = (v: Value): boolean => v.k === 'unres' && v.why === TOO_MANY_VALUES;

/** The typed gap for a value that couldn't be read, keeping its provenance and, when elsewhere, where it was read. */
export function withFrom(gap: Value, value: Value & {at?: Loc}, here: Loc): Value {
    const at = value.k === 'unres' || value.k === 'computed' ? value.at : undefined;
    const parts = gap.k === 'pat' && at && at !== here ? gap.parts.map((part) => (typeof part === 'string' ? part : {gap: {...part.gap, from: at}})) : undefined;
    return {...gap, ...(parts ? {parts} : {}), via: value.via, arms: value.arms} as Value;
}

/** Values with no provenance, attached to each instance the condition's values belong to (when they all belong to one). */
export function carryArms<T extends {arms?: Arm[]}>(values: T[], arms: Arm[] | undefined): T[] {
    return values.flatMap((value) => {
        const merged = mergeArms(value.arms, arms);
        return merged === false ? [] : [{...value, ...(merged ? {arms: merged} : {})}];
    });
}

export function perInstance(vals: Value[], cond: {vals: Value[]}): Value[] {
    const contextual = cond.vals.filter((value) => value.via?.length || value.arms?.length);
    if (!contextual.length) {
        return vals;
    }
    const contexts = [...new Map(contextual.map((value) => [JSON.stringify([value.via, value.arms]), value])).values()];
    const out = vals.flatMap((value) => ((value.via?.length || value.arms?.length) ? [value] : contexts.flatMap((context) => carryArms([{...value, ...(context.via ? {via: context.via} : {})}], context.arms))));
    if (contextual.length < cond.vals.length) {
        out.push({k: 'unres', why: 'unresolved-condition-context', at: ''});
    }
    return out;
}

export function isFalsy(v: Value): boolean {
    if (v.k !== 'lit') {
        return v.k === 'absent';
    }
    if (v.primitive === 'boolean') {
        return v.s === 'false';
    }
    return v.primitive === 'number' ? !Number(v.s) : v.s === '';
}

// a type with a falsy member; a gap of any other type (a callback, an object, a non-empty literal union) can't be empty
export const FALSY_TYPE = /\b(undefined|null|false|boolean|string|number|bigint|any|unknown)\b|''|""/;

export const neverFalsy = (p: Value & {k: 'pat'}) => p.parts.some((q) => (typeof q === 'string' ? q !== '' : q.gap.type.trim() !== '' && q.gap.type.trim() !== '?' && !FALSY_TYPE.test(q.gap.type)));

// a pattern is truthy when some part can't be empty: literal text, or a gap of a type with no falsy member
export const isTruthy = (v: Value) => (v.k === 'lit' && !isFalsy(v)) ||
    (v.k === 'pat' && neverFalsy(v)) ||
    ((v.k === 'unres' || v.k === 'computed') && v.truthy === true);

/**
 * Values of a branch taken when the condition is `want`. A value that came through usages is kept unless
 * the condition is known to be the opposite for that instance; a value with no provenance (a literal in
 * the branch) is attached to each instance where the condition is `want`.
 */
export function distribute(vals: Value[], cond: {vals: Value[]; negate: boolean}, want: boolean): Value[] {
    if (!cond.vals.length) {
        return vals;
    }
    const cut = cond.vals.find((value) => value.k === 'unres' && value.why === TOO_MANY_VALUES);
    const opposite = (value: Value) => (want === cond.negate ? isTruthy(value) : isFalsy(value));
    const conditions = distinctValues(cond.vals.filter((value) => value.k !== 'unres' || value.why !== TOO_MANY_VALUES));
    function* combinations(): Generator<Value> {
        for (const value of distinctValues(vals)) {
            for (const condition of conditions) {
                if (opposite(condition) || (value.via && condition.via && !prefixCompatible(value.via, condition.via))) {
                    continue;
                }
                const arms = mergeArms(value.arms, condition.arms);
                if (arms === false) {
                    continue;
                }
                const via = longer(value.via, condition.via);
                yield {...value, ...(via ? {via} : {}), ...(arms ? {arms} : {})};
            }
        }
    }
    function* withRemainder(): Generator<Value> {
        yield* combinations();
        if (cut) {
            yield cut;
        }
    }
    return distinctValues(withRemainder());
}

/** Collapse usage-chain suffixes when every continuation gives the same guard answer. */
export function conditionContexts(values: Value[]): Value[] {
    type Node = {children: Map<Loc, Node>; own: Value[]; answers: Map<string, Value>};
    const node = (): Node => ({children: new Map(), own: [], answers: new Map()});
    const groups = new Map<string, Node>();
    const contextFree: Value[] = [];
    function answerOf(value: Value): string {
        if (isFalsy(value)) {
            return 'false';
        }
        if (isTruthy(value)) {
            return 'true';
        }
        return value.k === 'unres' && value.why === TOO_MANY_VALUES ? 'truncated' : 'unknown';
    }
    for (const value of values) {
        if (!value.via?.length) {
            contextFree.push(value);
            continue;
        }
        const arms = JSON.stringify(value.arms?.slice().sort((a, b) => a.key.localeCompare(b.key)) ?? []);
        const root = groups.get(arms) ?? node();
        groups.set(arms, root);
        const answer = answerOf(value);
        let current = root;
        for (const loc of value.via) {
            const child = current.children.get(loc) ?? node();
            current.children.set(loc, child);
            child.answers.set(answer, value);
            current = child;
        }
        current.own.push(value);
    }
    const out = contextFree;
    const visit = (current: Node, via: Loc[]) => {
        if (via.length && current.answers.size === 1) {
            out.push({...current.answers.values().next().value!, via});
            return;
        }
        out.push(...current.own);
        for (const [loc, child] of current.children) {
            visit(child, [...via, loc]);
        }
    };
    for (const root of groups.values()) {
        visit(root, []);
    }
    return distinctValues(out);
}

/** Keep condition contexts distinct without materializing an unbounded Cartesian product. */
export function distinctValues(values: Iterable<Value>): Value[] {
    const seen = new Set<string>();
    const templates = new Set<string>();
    const out: Value[] = [];
    for (const value of values) {
        const key = JSON.stringify(value);
        if (seen.has(key)) {
            continue;
        }
        const template = templateOf(value) ?? JSON.stringify([value.k, value.k === 'unres' ? value.why : '']);
        if (!templates.has(template) && templates.size >= MAX_USAGE_VALUES) {
            out.push(truncated(''));
            break;
        }
        seen.add(key);
        templates.add(template);
        out.push(value);
    }
    return out;
}

export function prefixCompatible(a: Loc[], b: Loc[]): boolean {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

export function joinParts(px: Part[], py: Part[]): Part[] {
    const parts: Part[] = [];
    for (const p of [...px, ...py]) {
        const last = parts[parts.length - 1];
        if (typeof p === 'string' && typeof last === 'string') {
            parts[parts.length - 1] = last + p;
        } else if (p !== '') {
            parts.push(p);
        }
    }
    return parts;
}

export function longer(a: Loc[] | undefined, b: Loc[] | undefined): Loc[] | undefined {
    if (!a?.length) {
        return b?.length ? b : undefined;
    }
    return b && b.length > a.length ? b : a;
}

export function partsOf(v: Value): Part[] {
    if (v.k === 'lit') {
        return [v.s];
    }
    return v.k === 'pat' ? v.parts : [];
}

/**
 * Cartesian concatenation; provenance of both sides is kept (left first). Past the cap the rest are left out, and a
 * `too-many-values` value stands for them.
 */
export function concat(a: Value[], b: Value[], numericAddition = false): Value[] {
    const out: Value[] = [];
    const templates = new Set<string>();

    // Independent usages are linear gathering; bound products within each usage separately.
    const product = a.length > 1 && b.length > 1;
    const instanceTemplates = new Map<string, Set<string>>();
    for (const x of a) {
        for (const y of b) {
            if (x.k !== 'lit' && x.k !== 'pat') {
                out.push(x);
                continue;
            }
            if (y.k !== 'lit' && y.k !== 'pat') {
                out.push(y);
                continue;
            }

            // both sides came through usages: only the same instance's values combine
            if (x.via?.length && y.via?.length && !prefixCompatible(x.via, y.via)) {
                continue;
            }

            // opposite arms of one condition never render together
            const arms = mergeArms(x.arms, y.arms);
            if (arms === false) {
                continue;
            }
            const parts = joinParts(partsOf(x), partsOf(y));
            const via = longer(x.via, y.via);
            const setSource = x.setSource && y.setSource && x.setSource !== y.setSource ? undefined : x.setSource ?? y.setSource;
            const number = (value: Value & {k: 'lit'}) => (value.primitive === 'boolean' ? Number(value.s === 'true') : Number(value.s));
            let v: Value;
            if (numericAddition && x.k === 'lit' && y.k === 'lit' && x.primitive && y.primitive) {
                v = lit(String(number(x) + number(y)), via, 'number');
            } else {
                v = parts.every((p) => typeof p === 'string') ? lit((parts as string[]).join(''), via) : {k: 'pat', parts, ...(via ? {via} : {})};
            }

            // a recursive component's own prop stays marked through what's built from it
            if (v.k === 'pat' && ((x.k === 'pat' && x.recursive) || (y.k === 'pat' && y.recursive))) {
                v.recursive = true;
            }
            if (setSource) {
                v.setSource = setSource;
            }
            if (arms) {
                v.arms = arms;
            }
            out.push(v);
            const template = templateOf(v)!;
            templates.add(template);
            const context = JSON.stringify(v.via ?? []);
            const local = instanceTemplates.get(context) ?? new Set<string>();
            if (product) {
                local.add(template);
                instanceTemplates.set(context, local);
            }
            if (templates.size > MAX_USAGE_VALUES || (product && local.size > MAX_TEMPLATE_VALUES)) {
                out.push(truncated());
                return out;
            }
        }
    }
    return out;
}

/** A value as a template string, with each gap written `{key}`. */
export function templateOf(v: Value): string | null {
    if (v.k === 'lit') {
        return v.s;
    }
    if (v.k === 'pat') {
        return v.parts.map((p) => (typeof p === 'string' ? p : KEY_PLACEHOLDER)).join('');
    }
    return null;
}

export function gapsOf(v: Value): Gap[] {
    return v.k === 'pat' ? v.parts.filter((p): p is {gap: Gap} => typeof p !== 'string').map((p) => p.gap) : [];
}

export function withArm(vals: Value[], arm: {key: string; negate: boolean; origin?: string} | null, when: boolean): Value[] {
    if (!arm) {
        return vals;
    }
    const a: Arm = {key: arm.key, when: when !== arm.negate, ...(arm.origin ? {origins: [arm.origin]} : {})};
    return vals.flatMap((v) => {
        const merged = mergeArms(v.arms, [a]);
        return merged === false ? [] : [{...v, arms: merged} as Value];
    });
}

/** The arms of both sides, or false when one condition is taken both ways. */
export function mergeArms(a: Arm[] | undefined, b: Arm[] | undefined): Arm[] | undefined | false {
    if (!a?.length) {
        return b?.length ? b : undefined;
    }
    if (!b?.length) {
        return a;
    }
    const out = [...a];
    for (const y of b) {
        const x = out.find((o) => o.key === y.key);
        if (!x) {
            out.push(y);
        } else if (x.when !== y.when) {
            return false;
        } else if (y.origins?.length) {
            out[out.indexOf(x)] = {...x, origins: [...new Set([...(x.origins ?? []), ...y.origins])].sort()};
        }
    }
    return out;
}

/** Values in either list, each once (by value and usage chain). */
export function union(a: Value[], b: Value[]): Value[] {
    const seen = new Set<string>();
    const out: Value[] = [];
    for (const v of [...a, ...b]) {
        const k = JSON.stringify(v);
        if (!seen.has(k)) {
            seen.add(k);
            out.push(v);
        }
    }
    return out;
}

/** A value with the empty string taken out of its set-typed gaps (`a || 'fallback'`: '' takes the fallback). */
export function withoutEmptyMember(v: Value): Value {
    if (v.k !== 'pat') {
        return v;
    }
    let changed = false;
    const parts = v.parts.map((p): Part => {
        if (typeof p === 'string' || p.gap.kind !== 'set' || !p.gap.values?.includes('')) {
            return p;
        }
        const values = p.gap.values.filter((x) => x !== '');
        changed = true;
        return {gap: {...p.gap, values, type: values.map((x) => JSON.stringify(x)).join(' | ')}};
    });
    return changed ? {...v, parts} : v;
}
