// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {isJsxTag, strip} from './ast.ts';
import type {Loc} from './manifest_types.ts';
import type {CodeNode, ProgramIndex} from './program_index.ts';
import {typescript} from './typescript.ts';
import type {CallUsage, Usage} from './usage.ts';

/**
 * Passes over the dynamic usages before giving up on a fixpoint. Each pass reaches at least one more level of dynamically
 * rendered components; the webapp needs a handful. Exhausting it is an input error, never a silent cut.
 */
export const DYNAMIC_PASS_BUDGET = 64;

/**
 * Tags whose name is a value (`const Input = props.inputComponent; <Input/>`, `<props.as/>`) and
 * `React.createElement(X, props)` calls: the components they can render, found through value
 * sources (which needs the resolver, so this runs after the index is built). Adds them to the index's usages and
 * `dynamicVia`.
 */
export function addDynamicUsages(ix: ProgramIndex, sourcesOf: (e: ts.Expression) => Array<{expr: ts.Expression; via: Loc[]}>): {usages: number; passes: number; converged: boolean} {
    let added = 0;
    let paths = 0;
    const add = (target: CodeNode, u: Usage, via: Loc[]) => {
        if (ix.isLibraryNode(target)) {
            return;
        }
        const byUsage = ix.dynamicVia.get(target) ?? new Map<Usage, Loc[][]>();
        ix.dynamicVia.set(target, byUsage);
        const vias = byUsage.get(u);
        if (vias) {
            if (!vias.some((known) => known.length === via.length && known.every((loc, index) => loc === via[index]))) {
                vias.push(via);
                paths++;
            }
            return;
        }
        byUsage.set(u, [via]);
        ix.addUsage(target, u);
        added++;
        paths++;
    };
    const targetsOf = (e: ts.Expression): Array<[CodeNode, Loc[]]> => {
        const out: Array<[CodeNode, Loc[]]> = [];
        for (const src of sourcesOf(e)) {
            const s = strip(src.expr) as ts.Expression;
            if (typescript.isStringLiteralLike(s)) {
                continue;
            }
            const n = ix.unwrapExpr(s);
            if (n) {
                out.push([n, src.via]);
            }
        }
        return out;
    };

    // the candidates come from the (incremental) index: unchanged files aren't walked again. A dynamic tag can
    // take its component from a prop of a component that is itself rendered only dynamically (`actions.map((Action)
    // => <Action/>)` in a row rendered as `<RowComponentType/>`): that prop has no values (or misses a mount's) until
    // the row's usage, or its usage through that mount, is added. So passes repeat until one adds neither a usage nor
    // a supplying path: a fixpoint, since sources are depth-bounded and so are the paths. The pass budget only guards
    // against a fault there, and running out of it is reported, not silent.
    const calls = new Map<ts.CallExpression, CallUsage>();
    let passes = 0;
    let converged = false;
    while (!converged && passes < DYNAMIC_PASS_BUDGET) {
        const before = paths;
        passes++;
        for (const entry of ix.entries.values()) {
            for (const n of entry.dynamic) {
                if (isJsxTag(n)) {
                    for (const [t, via] of targetsOf(n.tagName as ts.Expression)) {
                        add(t, n, via);
                    }
                } else if (typescript.isCallExpression(n)) {
                    const u = calls.get(n) ?? {kind: 'call', call: n, props: n.arguments[1]};
                    calls.set(n, u);
                    for (const [t, via] of targetsOf(n.arguments[0])) {
                        add(t, u, via);
                    }
                }
            }
        }
        converged = paths === before;
    }
    ix.stats.dynamicUsages = added;
    ix.stats.dynamicPasses = passes;
    return {usages: added, passes, converged};
}

// ---- whether a value can change after it is built ---------------------------------------

/** What the write and escape analyses read from the index: the in-scope files and symbol lookup. */
export type SymbolScope = Pick<ProgramIndex, 'program' | 'checker' | 'files' | 'symbolAt'>;

/** The global `Object`'s functions that read an object's own members and never write them or keep it. */
const OBJECT_READERS = new Set(['keys', 'values', 'entries', 'getOwnPropertyNames', 'hasOwn']);

/** Per index: the symbols `escapes` has judged. */
const escapeCaches = new WeakMap<SymbolScope, Map<ts.Symbol, boolean>>();

/** Per index: every symbol in-scope code writes to, collected on the first `isWritten`. */
const writtenSymbols = new WeakMap<SymbolScope, Set<ts.Symbol>>();

/**
 * Whether a registry can be reached other than by reading its members: every in-scope reference to it must be the
 * object of a member read (`registry[id]`, `registry.one`, `Object.keys(registry)`) or a type query. An alias, an argument, a return, a
 * spread or an export lets code the scan does not follow add a choice, so any of them makes the registry open.
 */
export function escapes(ix: SymbolScope, symbol: ts.Symbol): boolean {
    let escapeCache = escapeCaches.get(ix);
    if (!escapeCache) {
        escapeCache = new Map();
        escapeCaches.set(ix, escapeCache);
    }
    const known = escapeCache.get(symbol);
    if (known !== undefined) {
        return known;
    }

    // an exported declaration is reachable from modules the scan may not read
    if (symbol.getDeclarations()?.some((d) => typescript.getCombinedModifierFlags(d) & typescript.ModifierFlags.Export)) {
        escapeCache.set(symbol, true);
        return true;
    }
    const name = symbol.getName();
    const declarations = new Set(symbol.getDeclarations()?.map((d) => (d as ts.NamedDeclaration).name).filter(Boolean));
    let escaped = false;
    const visit = (node: ts.Node): void => {
        if (escaped) {
            return;
        }
        if (typescript.isIdentifier(node) && node.text === name && !declarations.has(node)) {
            const found = typescript.isExportSpecifier(node.parent) ? ix.checker.getExportSpecifierLocalTargetSymbol(node.parent) : ix.symbolAt(node, {anyShorthandChild: true});
            const read = ((typescript.isPropertyAccessExpression(node.parent) || typescript.isElementAccessExpression(node.parent)) && node.parent.expression === node) ||
                (typescript.isCallExpression(node.parent) && node.parent.arguments[0] === node && isObjectReader(ix, node.parent));
            if (found === symbol && !read && !typescript.isTypeQueryNode(node.parent)) {
                escaped = true;
                return;
            }
        }
        typescript.forEachChild(node, visit);
    };
    ix.files.forEach(visit);
    escapeCache.set(symbol, escaped);
    return escaped;
}

/** `Object.keys(x)` and the like, where `Object` is the standard library's, never a local or imported one. */
function isObjectReader(ix: SymbolScope, call: ts.CallExpression): boolean {
    const callee = strip(call.expression);
    if (!typescript.isPropertyAccessExpression(callee) || !typescript.isIdentifier(callee.expression) || callee.expression.text !== 'Object' || !OBJECT_READERS.has(callee.name.text)) {
        return false;
    }
    const declarations = ix.checker.getSymbolAtLocation(callee.expression)?.declarations ?? [];
    return declarations.length > 0 && declarations.every((declaration) => ix.program.isSourceFileDefaultLibrary(declaration.getSourceFile()));
}

export function isConst(declaration: ts.Declaration): boolean {
    return Boolean(typescript.getCombinedNodeFlags(declaration) & typescript.NodeFlags.Const);
}

/**
 * Whether in-scope code writes to the symbol after its declaration: an assignment, compound assignment, `++`/`--`
 * or `delete` whose target is rooted at it (`x = ...`, `x.a = ...`, `x[k] = ...`), or a call that writes its first
 * argument (`Object.assign`, `Object.defineProperty`, `Object.defineProperties`, `Reflect.set`, `Reflect.defineProperty`).
 */
export function isWritten(ix: SymbolScope, symbol: ts.Symbol): boolean {
    let written = writtenSymbols.get(ix);
    if (!written) {
        written = collectWritten(ix);
        writtenSymbols.set(ix, written);
    }
    return written.has(symbol);
}

function collectWritten(ix: SymbolScope): Set<ts.Symbol> {
    const written = new Set<ts.Symbol>();
    const rootOf = (target: ts.Expression): ts.Symbol | undefined => {
        let node = strip(target) as ts.Expression;
        while (typescript.isPropertyAccessExpression(node) || typescript.isElementAccessExpression(node)) {
            node = strip(node.expression) as ts.Expression;
        }
        if (!typescript.isIdentifier(node)) {
            return undefined;
        }
        return ix.checker.getSymbolAtLocation(node) && ix.symbolAt(node, {anyShorthandChild: true});
    };
    const mark = (target: ts.Expression) => {
        const value = strip(target) as ts.Expression;

        // a destructuring assignment writes every name it lists: `({dialogType} = other)`, `[a, b] = pair`
        if (typescript.isObjectLiteralExpression(value) || typescript.isArrayLiteralExpression(value)) {
            const elements = typescript.isArrayLiteralExpression(value) ? value.elements : value.properties;
            for (const element of elements) {
                if (typescript.isShorthandPropertyAssignment(element)) {
                    const found = ix.symbolAt(element.name);
                    if (found) {
                        written.add(found);
                    }
                } else if (typescript.isPropertyAssignment(element)) {
                    mark(element.initializer);
                } else if (typescript.isSpreadElement(element) || typescript.isSpreadAssignment(element)) {
                    mark(element.expression);
                } else if (!typescript.isOmittedExpression(element) && typescript.isExpression(element)) {
                    mark(typescript.isBinaryExpression(element) ? element.left : element);
                }
            }
            return;
        }
        const root = rootOf(value);
        if (root) {
            written.add(root);
        }
    };
    const WRITERS = new Set(['Object.assign', 'Object.defineProperty', 'Object.defineProperties', 'Reflect.set', 'Reflect.defineProperty']);
    const visit = (node: ts.Node): void => {
        if (typescript.isBinaryExpression(node) && node.operatorToken.kind >= typescript.SyntaxKind.FirstAssignment && node.operatorToken.kind <= typescript.SyntaxKind.LastAssignment) {
            mark(node.left);
        } else if ((typescript.isPrefixUnaryExpression(node) || typescript.isPostfixUnaryExpression(node)) && (node.operator === typescript.SyntaxKind.PlusPlusToken || node.operator === typescript.SyntaxKind.MinusMinusToken)) {
            mark(node.operand);
        } else if (typescript.isDeleteExpression(node)) {
            mark(node.expression);
        } else if (typescript.isCallExpression(node) && WRITERS.has(strip(node.expression).getText()) && node.arguments[0]) {
            mark(node.arguments[0]);
        }
        typescript.forEachChild(node, visit);
    };
    ix.files.forEach(visit);
    return written;
}
