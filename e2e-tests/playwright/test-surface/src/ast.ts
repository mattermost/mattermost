// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {typescript} from './typescript.ts';

export type FunctionLike = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration;
export type JsxTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

export function isFunctionLike(n: ts.Node | undefined | null): n is FunctionLike {
    return Boolean(n) && (typescript.isFunctionDeclaration(n!) || typescript.isArrowFunction(n!) || typescript.isFunctionExpression(n!) || typescript.isMethodDeclaration(n!));
}

export function isJsxTag(n: ts.Node): n is JsxTag {
    return typescript.isJsxOpeningElement(n) || typescript.isJsxSelfClosingElement(n);
}

/** Removes wrappers that don't change a value: parens, `as`, `!`, `satisfies`. */
export function strip<T extends ts.Node | undefined>(e: T): T | ts.Expression {
    let x: ts.Node | undefined = e;
    while (x && (typescript.isParenthesizedExpression(x) || typescript.isAsExpression(x) || typescript.isNonNullExpression(x) || typescript.isSatisfiesExpression(x) || typescript.isTypeAssertionExpression(x))) {
        x = x.expression;
    }
    return x as T | ts.Expression;
}

/** `a.b.c` -> `c`, `f` -> `f`, anything else -> ''. */
export function exprName(e: ts.Expression): string {
    if (typescript.isPropertyAccessExpression(e)) {
        return e.name.text;
    }
    return typescript.isIdentifier(e) ? e.text : '';
}

/** Last name of a callee: `a.b.c(...)` -> `c`, `f(...)` -> `f`. */
export function calleeName(call: ts.CallExpression): string {
    const x = strip(call.expression);
    if (typescript.isPropertyAccessExpression(x)) {
        return x.name.text;
    }
    if (typescript.isIdentifier(x)) {
        return x.text;
    }
    return '';
}

/** Return expressions of a function, not descending into nested functions. */
export function returnsOf(fn: ts.SignatureDeclaration | {body?: ts.Node}): ts.Expression[] {
    const body = (fn as {body?: ts.Node}).body;
    if (!body) {
        return [];
    }
    if (!typescript.isBlock(body)) {
        return [body as ts.Expression];
    }
    const out: ts.Expression[] = [];
    const visit = (n: ts.Node) => {
        if (typescript.isReturnStatement(n) && n.expression) {
            out.push(n.expression);
        }
        if (!typescript.isFunctionLike(n) && !typescript.isClassLike(n)) {
            typescript.forEachChild(n, visit);
        }
    };
    typescript.forEachChild(body, visit);
    return out;
}

export function jsxAttr(tag: JsxTag, name: string): ts.JsxAttribute | undefined {
    return tag.attributes.properties.find((p): p is ts.JsxAttribute => typescript.isJsxAttribute(p) && attrName(p) === name);
}

export function attrName(a: ts.JsxAttribute): string {
    return a.name.getText();
}

/** The expression an attribute carries: `x='a'` -> 'a' literal, `x={e}` -> e, bare `x` -> undefined. */
export function attrValue(a: ts.JsxAttribute | undefined): ts.Expression | undefined {
    if (!a || !a.initializer) {
        return undefined;
    }
    if (typescript.isJsxExpression(a.initializer)) {
        return a.initializer.expression;
    }
    return a.initializer as ts.Expression;
}

export function tagName(tag: JsxTag): string {
    return tag.tagName.getText();
}

export function isIntrinsic(tag: JsxTag): boolean {
    return typescript.isIdentifier(tag.tagName) && (/^[a-z]/).test(tag.tagName.text);
}

/** The text of a property name: identifiers, string literals, computed string literals. */
export function propName(name: ts.PropertyName | ts.BindingName | undefined): string | null {
    if (!name) {
        return null;
    }
    if (typescript.isIdentifier(name) || typescript.isStringLiteral(name) || typescript.isNumericLiteral(name) || typescript.isPrivateIdentifier(name)) {
        return name.text;
    }
    if (typescript.isComputedPropertyName(name) && typescript.isStringLiteralLike(name.expression)) {
        return name.expression.text;
    }
    return null;
}

/** typeToString with union members sorted: the checker's member order depends on type creation order. */
export function typeText(checker: ts.TypeChecker, t: ts.Type, flags = typescript.TypeFormatFlags.NoTruncation): string {
    if (t.isUnion() && !(t.flags & typescript.TypeFlags.Boolean)) {
        return [...new Set(t.types.map((m) => checker.typeToString(m, undefined, flags)))].sort().join(' | ');
    }
    return checker.typeToString(t, undefined, flags);
}

/** `s` as a regular expression that matches it literally. */
export function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A node's source on one line (whitespace runs collapsed), whole: for identity, where `shortText` is for display. */
export function oneLine(n: ts.Node): string {
    return n.getText().replace(/\s+/g, ' ');
}

export function shortText(n: ts.Node, max = 60): string {
    const t = n.getText().replace(/\s+/g, ' ');
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** Function or class that declares a component (or any function) around a node. */
export function enclosingFunction(n: ts.Node): FunctionLike | undefined {
    for (let p = n.parent; p; p = p.parent) {
        if (isFunctionLike(p)) {
            return p;
        }
    }
    return undefined;
}

export function nameOfFunction(fn: ts.Node): string {
    const f = fn as ts.FunctionDeclaration;
    if (f.name && typescript.isIdentifier(f.name)) {
        return f.name.text;
    }
    if (typescript.isClassLike(fn) && fn.name) {
        return fn.name.text;
    }
    if (typescript.isMethodDeclaration(fn)) {
        const cls = fn.parent;
        const m = propName(fn.name) ?? '?';
        return typescript.isClassLike(cls) && cls.name ? `${cls.name.text}.${m}` : m;
    }
    let p: ts.Node | undefined = fn.parent;

    // const X = memo(forwardRef((props) => ...)) -> X
    while (p && (typescript.isCallExpression(p) || typescript.isParenthesizedExpression(p) || typescript.isAsExpression(p))) {
        p = p.parent;
    }
    if (p && typescript.isVariableDeclaration(p) && typescript.isIdentifier(p.name)) {
        return p.name.text;
    }
    if (p && typescript.isPropertyAssignment(p)) {
        return propName(p.name) ?? '(anonymous)';
    }
    if (p && typescript.isExportAssignment(p)) {
        return 'default';
    }
    return '(anonymous)';
}

export function componentName(node: FunctionLike | ts.ClassLikeDeclaration): string {
    if (typescript.isClassLike(node)) {
        return node.name?.text ?? nameOfFunction(node);
    }
    const own = nameOfFunction(node);
    if (own !== '(anonymous)' && (/^[A-Z]/).test(own)) {
        return own;
    }
    for (let parent = node.parent; parent; parent = parent.parent) {
        if ((typescript.isVariableDeclaration(parent) || typescript.isFunctionDeclaration(parent) || typescript.isClassDeclaration(parent)) && parent.name && typescript.isIdentifier(parent.name)) {
            return parent.name.text;
        }
    }
    return own;
}
