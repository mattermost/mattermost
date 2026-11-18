// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {lit} from './algebra.ts';
import {type GroupedKeyDeps, recordKeys} from './grouped_keys.ts';
import type {KeyClassifier} from './keys.ts';
import {isGlobalObject, stringLiteralsOf} from './type_utils.ts';
import type {Gap, Value} from './types.ts';

import {shortText, strip, typeText} from '../ast.ts';
import {typescript} from '../typescript.ts';

/** What a value read from a checker type needs: what naming a record's keys needs, and how a key's type is classified. */
export type TypedDeps = {
    ix: GroupedKeyDeps['ix'];
    keys: GroupedKeyDeps['keys'] & Pick<KeyClassifier, 'classify' | 'configuredField' | 'fieldOf' | 'gapFor'>;
};

/** A value the program can't know but whose type is always truthy: a function or object that is never null or undefined. */
export function alwaysTruthy(checker: ts.TypeChecker, n: ts.Node): boolean {
    let t: ts.Type;
    try {
        t = checker.getTypeAtLocation(n);
    } catch {
        return false;
    }
    const parts = t.isUnion() ? t.types : [t];
    return parts.every((p) => (p.flags & typescript.TypeFlags.Object) !== 0 && !(p.flags & (typescript.TypeFlags.Any | typescript.TypeFlags.Unknown)));
}

/**
 * Runtime data whose type upstream says less than the type where it's read (the list passes
 * `PostDraft | ScheduledPost`, the row reads `(item as ScheduledPost).id`): the reading here
 * types the key, and the value keeps the usage chain it came through.
 */
export function typedHere(keys: Pick<KeyClassifier, 'gapFor'>, v: Value, x: ts.Expression): Value {
    const g = v.k === 'pat' && v.parts.length === 1 ? v.parts[0] : null;
    if (!g || typeof g === 'string' || g.gap.kind !== 'string') {
        return v;
    }
    const here = keys.gapFor(x);
    const hg = here.k === 'pat' ? here.parts[0] : null;
    return hg && typeof hg !== 'string' && hg.gap.kind !== 'string' ? {...here, ...(v.via ? {via: v.via} : {}), ...(v.arms ? {arms: v.arms} : {})} : v;
}

/** Runtime data reached through a props path: the type of `expr.rest...`. */
export function dataGap(deps: TypedDeps, expr: ts.Expression, rest: string[], elementOf = false): Value {
    const {checker} = deps.ix;
    const {keys} = deps;
    let t: ts.Type | null = checker.getTypeAtLocation(expr);
    if (elementOf && t) {
        // `field.options?.map(…)` is `T[] | undefined`: the element is the array's, not the union's
        const array = checker.getNonNullableType(t);
        t = checker.getIndexTypeOfType(array, typescript.IndexKind.Number) ?? t;
    }
    let owner: ts.Type | null = null;
    let field: string | null = null;
    for (const k of rest) {
        if (!t) {
            break;
        }

        // `teams.find(…).name`: the property of the value when there is one (`Team | undefined` -> `Team`)
        t = checker.getNonNullableType(t);
        owner = t;
        field = k;
        const prop = t.getProperty(k);
        t = prop ? checker.getTypeOfSymbolAtLocation(prop, expr) : null;
    }
    const info: Gap = {kind: 'string', type: t ? typeText(checker, t) : 'unknown', expr: shortText(expr, 40) + (elementOf ? '[]' : '') + (rest.length ? '.' + rest.join('.') : '')};
    const origin = keys.classify(info, t, owner, field);
    keys.configuredField(info, origin.owner, origin.field);

    // an element of an array field itself (`...nodes` of a destructured prop): that field's keyFields entry
    if (elementOf && !rest.length && info.kind === 'string') {
        const array = keys.fieldOf(expr);
        if (array) {
            keys.configuredField(info, array.owner, array.field);
        }

        // an element of a record's keys reached through a helper's return (`orderAreas(byArea)` returning
        // `Object.keys(findingsByArea).sort(…)`): the record's keys entry
        const keysCall = strip(expr) as ts.Expression;
        const callee = typescript.isCallExpression(keysCall) ? strip(keysCall.expression) : undefined;
        if (callee && typescript.isPropertyAccessExpression(callee) && callee.name.text === 'keys' && typescript.isIdentifier(callee.expression) && callee.expression.text === 'Object' && isGlobalObject(deps.ix, callee.expression) && (keysCall as ts.CallExpression).arguments[0]) {
            recordKeys(deps, info, (keysCall as ts.CallExpression).arguments[0]);
        }
    }
    return {k: 'pat', parts: [{gap: info}]};
}

/** Read the non-null literal alternatives of an expression’s checker type. */
export function literalsFromType(checker: ts.TypeChecker, e: ts.Expression): Value[] | null {
    const t = checker.getTypeAtLocation(e);
    if (t.isStringLiteral()) {
        return [lit(t.value)];
    }
    const ls = stringLiteralsOf(t);
    const source = t.aliasSymbol?.getName();
    return ls ? ls.map((s) => ({...lit(s), ...(source ? {setSource: source} : {})})) : null;
}
