// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {constOrigin, type GroupedKeyDeps, recordKeys} from './grouped_keys.ts';
import {LIST_METHODS} from './sources.ts';
import {isGlobalObject} from './type_utils.ts';
import type {Gap, Value} from './types.ts';

import {shortText, strip} from '../ast.ts';
import {typescript} from '../typescript.ts';

/** What a collection key needs: the same symbols, calls and keyFields entries as naming an open record's keys. */
export type CollectionDeps = GroupedKeyDeps;

/**
 * The key of an `Object.entries(x)` / `Object.keys(x)` element, by declaration: `for (const [key] of Object.entries(x))`,
 * `for (const key of Object.keys(x))`, and the same as the first parameter of an iteration callback
 * (`Object.entries(x).map(([key]) => …)`). A key gap whose origin is the keys of x: a set when x's type has a fixed
 * set of keys and no index signature, otherwise an open string that names `x` (not the variable it was bound to).
 */
export function collectionKey(deps: CollectionDeps, d: ts.Declaration): Value | null {
    const checker = deps.ix.checker;
    let holder: ts.Node | undefined;
    let method: 'entries' | 'keys';
    if (typescript.isBindingElement(d) && typescript.isArrayBindingPattern(d.parent) && d.parent.elements.indexOf(d) === 0 && !d.dotDotDotToken) {
        holder = d.parent.parent;
        method = 'entries';
    } else if ((typescript.isVariableDeclaration(d) || typescript.isParameter(d)) && typescript.isIdentifier(d.name)) {
        holder = d;
        method = 'keys';
    } else {
        return null;
    }
    let iterated: ts.Expression | undefined;
    if (typescript.isVariableDeclaration(holder) && typescript.isVariableDeclarationList(holder.parent) && typescript.isForOfStatement(holder.parent.parent)) {
        iterated = holder.parent.parent.expression;
    } else if (typescript.isParameter(holder) && holder.parent.parameters[0] === holder && holder.parent.parent && typescript.isCallExpression(holder.parent.parent)) {
        const call = holder.parent.parent;
        const callee = strip(call.expression);
        if (call.arguments[0] === holder.parent && typescript.isPropertyAccessExpression(callee) && LIST_METHODS.includes(callee.name.text)) {
            iterated = callee.expression;
        }
    }
    const source = iterated && strip(iterated);

    // an element of an array field (`for (const p of group.permissions)`): the field's keyFields entry, if it has one
    if (method === 'keys' && source && typescript.isPropertyAccessExpression(source) && checker.isArrayLikeType(checker.getTypeAtLocation(source))) {
        const owner = checker.getNonNullableType(checker.getTypeAtLocation(source.expression));
        const entry = deps.keys.keyFieldEntry(owner, source.name.text);
        if (!entry) {
            return null;
        }
        const element: Gap = {kind: 'id', type: 'string', expr: `${shortText(source)}[]`, entity: entry.entity, field: entry.field, value: entry.value ?? entry.field, freeForm: Boolean(entry.freeForm), fieldEntry: entry};
        return {k: 'pat', parts: [{gap: element}]};
    }
    if (!source || !typescript.isCallExpression(source) || !source.arguments[0]) {
        return null;
    }
    const object = strip(source.expression);
    if (!typescript.isPropertyAccessExpression(object) || !typescript.isIdentifier(object.expression) || object.expression.text !== 'Object' || object.name.text !== method || !isGlobalObject(deps.ix, object.expression)) {
        return null;
    }
    const target = source.arguments[0];
    const info: Gap = {kind: 'string', type: 'string', expr: `Object.${method}(${shortText(target)})[]${method === 'entries' ? '.key' : ''}`};

    const origin = constOrigin(deps.ix, target);
    const type = checker.getNonNullableType(checker.getTypeAtLocation(origin));
    const keys = type.getProperties().map((property) => property.getName());
    if (keys.length && !checker.getIndexInfosOfType(type).length) {
        info.kind = 'set';
        info.values = [...new Set(keys)].sort();
        info.type = info.values.map((key) => JSON.stringify(key)).join(' | ');
        return {k: 'pat', parts: [{gap: info}]};
    }
    recordKeys(deps, info, target);
    return {k: 'pat', parts: [{gap: info}]};
}
