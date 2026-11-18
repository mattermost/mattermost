// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {strip} from './ast.ts';
import {escapes, isConst, isWritten} from './dynamic_usages.ts';
import type {CodeNode, ProgramIndex} from './program_index.ts';
import {typescript} from './typescript.ts';

/**
 * Dialog descriptors -> the components they can mount. A descriptor names its component in a `dialogType` field
 * (`{dialogType: X, dialogProps}`) or attribute (`<ToggleModalButton dialogType={X}>`); the index records each one as
 * a dialog input, and this module turns it into candidate mounts (`ix.dialogRefs`), or marks it unresolved.
 */

/** Structural descriptor alternatives, without invoking the function that stores or uses the descriptor. */
export function dialogTargets(ix: ProgramIndex, expression: ts.Expression, seen = new Set<ts.Node>(), unresolved?: Set<ts.Expression>): CodeNode[] {
    const value = strip(expression) as ts.Expression;
    if (seen.has(value)) {
        unresolved?.add(value);
        return [];
    }
    seen.add(value);
    if (typescript.isConditionalExpression(value)) {
        return [...dialogTargets(ix, value.whenTrue, new Set(seen), unresolved), ...dialogTargets(ix, value.whenFalse, new Set(seen), unresolved)];
    }
    const target = ix.unwrapExpr(value);
    if (target) {
        return [target];
    }
    const declaration = typescript.isIdentifier(value) ? ix.checker.getSymbolAtLocation(value)?.valueDeclaration : undefined;
    if (declaration && typescript.isVariableDeclaration(declaration) && declaration.initializer) {
        return dialogTargets(ix, declaration.initializer, seen, unresolved);
    }
    const type = ix.checker.getTypeAtLocation(value);
    if (!(type.flags & (typescript.TypeFlags.Null | typescript.TypeFlags.Undefined | typescript.TypeFlags.Never))) {
        unresolved?.add(value);
    }
    return [];
}

/**
 * Resolves every dialog input of the index through value sources (which needs the resolver, so this runs after the
 * index is built): adds each component a descriptor can mount to `ix.dialogRefs`, and refills `ix.unresolvedDialogs`
 * with the descriptors whose components are not all known.
 */
export function resolveDialogMounts(ix: ProgramIndex, sourcesOf: (expression: ts.Expression) => Array<{expr?: ts.Expression}>): void {
    ix.unresolvedDialogs.clear();
    const expand = (expression: ts.Expression, seen = new Set<ts.Node>()): Array<{expr?: ts.Expression}> => {
        const value = strip(expression) as ts.Expression;
        if (seen.has(value)) {
            return [{}];
        }
        seen.add(value);
        if (typescript.isElementAccessExpression(value)) {
            const symbol = ix.checker.getSymbolAtLocation(value.expression);
            const declaration = symbol?.valueDeclaration;
            const object = declaration && typescript.isVariableDeclaration(declaration) ? strip(declaration.initializer) : undefined;

            // a registry is finite only when nothing can add to it: a const that no code writes to after it is built
            if (object && typescript.isObjectLiteralExpression(object) && !(isConst(declaration!) && !isWritten(ix, symbol!) && !escapes(ix, symbol!))) {
                return [{}];
            }
            if (object && typescript.isObjectLiteralExpression(object)) {
                return object.properties.flatMap((property) => {
                    if (typescript.isPropertyAssignment(property)) {
                        return expand(property.initializer, new Set(seen));
                    }
                    if (typescript.isShorthandPropertyAssignment(property)) {
                        return expand(property.name, new Set(seen));
                    }
                    return [{}];
                });
            }
        }
        const sources = sourcesOf(value);
        return sources.flatMap((source) => (source.expr && strip(source.expr) !== value ? expand(source.expr, new Set(seen)) : [source]));
    };
    for (const [input, reference] of ix.dialogInputs) {
        // a forward declares nothing, except the default a destructured binding gives in its own right
        const expression = isDialogForward(ix, input) ? forwardDefault(ix, input) : input;
        if (!expression) {
            continue;
        }
        const sources = expand(expression);
        const missing = new Set<ts.Expression>();
        const targets = [...new Set(sources.flatMap((source) => (source.expr ? dialogTargets(ix, source.expr, new Set(), missing) : [])))];
        if (!targets.length || missing.size || sources.some((source) => !source.expr)) {
            ix.unresolvedDialogs.add(expression);
        }
        for (const target of targets) {
            const refs = ix.dialogRefs.get(target) ?? [];
            if (!refs.some((ref) => ref.node === reference.node)) {
                ix.addDialogRef(target, reference);
            }
        }
    }
}

/** Descriptor field copies introduce no component choice; definitions are judged where the field is built. */
export function isDialogForward(ix: ProgramIndex, expression: ts.Expression): boolean {
    const value = strip(expression) as ts.Expression;
    if (typescript.isPropertyAccessExpression(value)) {
        return value.name.text === 'dialogType';
    }
    if (typescript.isElementAccessExpression(value)) {
        return Boolean(value.argumentExpression && typescript.isStringLiteralLike(value.argumentExpression) && value.argumentExpression.text === 'dialogType');
    }
    const binding = dialogBinding(ix, value);
    return Boolean(binding);
}

/**
 * The binding a forward reads `dialogType` through (`const {dialogType} = d`, `({dialogType}) => ...`), when that
 * is all it can hold: a const or a parameter that no code assigns to afterwards. A reassigned or `let` binding is
 * not a forward and goes through the value resolver like any other value.
 */
function dialogBinding(ix: ProgramIndex, value: ts.Expression): ts.BindingElement | null {
    if (!typescript.isIdentifier(value)) {
        return null;
    }
    const symbol = ix.symbolAt(value, {anyShorthandChild: true});
    const declaration = symbol?.valueDeclaration;
    if (!symbol || !declaration || !typescript.isBindingElement(declaration) || !typescript.isObjectBindingPattern(declaration.parent)) {
        return null;
    }
    if ((declaration.propertyName ?? declaration.name).getText().replace(/^['"]|['"]$/g, '') !== 'dialogType') {
        return null;
    }
    let root: ts.Node = declaration;
    while (typescript.isBindingElement(root) || typescript.isObjectBindingPattern(root) || typescript.isArrayBindingPattern(root)) {
        root = root.parent;
    }
    const fixed = typescript.isParameter(root) || (typescript.isVariableDeclaration(root) && isConst(root));
    return fixed && !isWritten(ix, symbol) ? declaration : null;
}

/** The default of a forward's destructured binding (`const {dialogType = Fallback} = d`): a definition of its own. */
function forwardDefault(ix: ProgramIndex, value: ts.Expression): ts.Expression | null {
    return dialogBinding(ix, strip(value) as ts.Expression)?.initializer ?? null;
}
