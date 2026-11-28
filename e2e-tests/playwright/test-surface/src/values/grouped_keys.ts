// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import type {KeyClassifier} from './keys.ts';
import {isLet} from './type_utils.ts';
import type {Gap} from './types.ts';
import {onlyReads, type WriteDeps} from './writes.ts';

import {isFunctionLike, returnsOf, strip, type FunctionLike} from '../ast.ts';
import {type KeyFieldAllow} from '../config.ts';
import {MAX_RESOLVE_DEPTH} from '../limits.ts';
import type {ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';

/** What naming a record's keys needs: symbols, calls and the functions they reach, and the keyFields entries. */
export type GroupedKeyDeps = {
    ix: WriteDeps & Pick<ProgramIndex, 'calls'>;
    keys: Pick<KeyClassifier, 'keyFieldEntry'>;
};

/**
 * Keys an open record's keys (`Object.keys(target)`, `Object.entries(target)`) by a keyFields entry: a record field
 * an entry declares with 'keys: true' (free-form, named by 'value'), also as a helper's parameter every call passes
 * the same such field (`this.renderRootMenu(this.props.adminDefinition)`), or the field a record is grouped by
 * (`byArea[finding.area] = []`).
 */
export function recordKeys(deps: GroupedKeyDeps, info: Gap, target: ts.Expression): void {
    const {ix, keys} = deps;
    const origin = constOrigin(ix, target);
    const recordEntry = (field: ts.Expression) => {
        const e = strip(field) as ts.Expression;
        if (!typescript.isPropertyAccessExpression(e)) {
            return undefined;
        }
        return keys.keyFieldEntry(ix.checker.getNonNullableType(ix.checker.getTypeAtLocation(e.expression)), e.name.text, {keys: true});
    };
    let entry = recordEntry(origin);
    const parameter = typescript.isIdentifier(origin) ? ix.symbolAt(origin)?.valueDeclaration : undefined;
    if (!entry && parameter && typescript.isParameter(parameter)) {
        const fn = parameter.parent as FunctionLike;
        const index = fn.parameters.indexOf(parameter);
        const passed = (ix.calls.get(fn) ?? []).map((call) => (call.arguments[index] ? recordEntry(call.arguments[index]) : undefined));
        entry = passed.length && passed.every((item) => item && item === passed[0]) ? passed[0] : undefined;
    }
    entry ??= groupedKeyEntry(deps, target, 0, new Set());
    if (entry?.value) {
        info.kind = 'id';
        info.entity = entry.entity;
        info.field = entry.field;
        info.value = entry.value;
        info.freeForm = true;
        info.fieldEntry = entry;
    }
}

/**
 * The keyFields entry a record is grouped by: the record a local is built as (`const byArea = {}` written as
 * `byArea[finding.area] = []`, read as `byArea[finding.area].push(…)`), reached through the parameters (each call's
 * argument), calls (the function's returns) and const initializers it flows through. Every element access must be
 * keyed by a field of the same entry, and every path must agree; otherwise there is none.
 */
function groupedKeyEntry(deps: GroupedKeyDeps, expr: ts.Expression, depth: number, seen: Set<ts.Node>, builder?: FunctionLike): KeyFieldAllow | undefined {
    const {ix} = deps;
    const e = strip(expr) as ts.Expression;
    if (depth > MAX_RESOLVE_DEPTH) {
        return undefined;
    }
    const agree = (entries: Array<KeyFieldAllow | undefined>) => (entries.length && entries.every((item) => item && item === entries[0]) ? entries[0] : undefined);
    if (typescript.isCallExpression(e)) {
        const fn = ix.unwrapExpr(e.expression);
        if (!fn || !isFunctionLike(fn) || ix.isLibraryNode(fn) || seen.has(fn)) {
            return undefined;
        }
        return agree(returnsOf(fn).map((returned) => groupedKeyEntry(deps, returned, depth + 1, new Set([...seen, fn]), fn)));
    }
    if (!typescript.isIdentifier(e)) {
        return undefined;
    }
    const symbol = ix.symbolAt(e);
    const declaration = symbol?.valueDeclaration;
    if (!symbol || !declaration || seen.has(declaration)) {
        return undefined;
    }
    const next = new Set([...seen, declaration]);

    // a name the record passes through (the caller's `const byArea = group(…)`, a helper's `findingsByArea`) must only
    // read it: a write or an escape there could add keys the grouping doesn't name
    if ((typescript.isParameter(declaration) || (typescript.isVariableDeclaration(declaration) && declaration.initializer && !(typescript.isObjectLiteralExpression(strip(declaration.initializer) as ts.Expression) && !(strip(declaration.initializer) as ts.ObjectLiteralExpression).properties.length))) && !onlyReads(ix, symbol, declaration, depth)) {
        return undefined;
    }
    if (typescript.isParameter(declaration)) {
        const fn = declaration.parent as FunctionLike;
        const index = fn.parameters.indexOf(declaration);
        return agree((ix.calls.get(fn) ?? []).map((call) => (call.arguments[index] ? groupedKeyEntry(deps, call.arguments[index], depth + 1, next) : undefined)));
    }
    if (!typescript.isVariableDeclaration(declaration) || !declaration.initializer) {
        return undefined;
    }
    const initializer = strip(declaration.initializer) as ts.Expression;
    if (!typescript.isObjectLiteralExpression(initializer) || initializer.properties.length) {
        return isLet(declaration) ? undefined : groupedKeyEntry(deps, initializer, depth + 1, next, builder);
    }

    // an empty object filled by key: the keys of every element access of it in its scope. Only a record that never
    // escapes is proven: every other reference (`const alias = result`, `fill(result)`, `Object.assign(result, …)`)
    // could add keys this walk doesn't see, so it proves nothing
    // and a record made fresh for each call: declared directly in the builder whose return it is (not in a module, nor
    // in an outer factory's closure that every call shares), or, read where it is built, inside a function
    const declaredIn = typescript.findAncestor(declaration.parent, (node) => isFunctionLike(node));
    if (builder ? declaredIn !== builder : !declaredIn) {
        return undefined;
    }
    const scope = typescript.findAncestor(declaration, (node) => isFunctionLike(node) || typescript.isSourceFile(node)) ?? declaration.getSourceFile();
    const keys: Array<KeyFieldAllow | undefined> = [];
    let escapes = false;
    const visit = (node: ts.Node) => {
        if (escapes) {
            return;
        }
        if (typescript.isIdentifier(node) && node !== declaration.name && ix.symbolAt(node) === symbol) {
            const parent = node.parent;
            if (typescript.isElementAccessExpression(parent) && parent.expression === node) {
                const key = strip(parent.argumentExpression) as ts.Expression;
                keys.push(typescript.isPropertyAccessExpression(key) ? deps.keys.keyFieldEntry(ix.checker.getNonNullableType(ix.checker.getTypeAtLocation(key.expression)), key.name.text, {withValue: true}) : undefined);
            } else if (!(typescript.isReturnStatement(parent) && parent.expression === node)) {
                escapes = true;
            }
        }
        typescript.forEachChild(node, visit);
    };
    visit(scope);
    return escapes ? undefined : agree(keys);
}

/** A local's keys are the keys of what it was built from: the expression const initializers lead to. */
export function constOrigin(ix: Pick<ProgramIndex, 'symbolAt'>, target: ts.Expression): ts.Expression {
    let origin = strip(target) as ts.Expression;
    for (let hop = 0; hop < MAX_RESOLVE_DEPTH && typescript.isIdentifier(origin); hop++) {
        const declaration = ix.symbolAt(origin)?.valueDeclaration;
        if (!declaration || !typescript.isVariableDeclaration(declaration) || !declaration.initializer || isLet(declaration)) {
            break;
        }
        origin = strip(declaration.initializer) as ts.Expression;
    }
    return origin;
}
