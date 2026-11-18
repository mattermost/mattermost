// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {isFunctionLike} from '../ast.ts';
import {MAX_RESOLVE_DEPTH, MAX_TEMPLATE_VALUES} from '../limits.ts';
import {typescript} from '../typescript.ts';

/** The class `this` refers to: arrows don't rebind it, function declarations/expressions do. */
export function classOfThis(node: ts.Node): ts.ClassLikeDeclaration | null {
    for (let n = node.parent; n; n = n.parent) {
        if (typescript.isClassLike(n)) {
            return n;
        }
        if (typescript.isFunctionDeclaration(n) || typescript.isFunctionExpression(n)) {
            return null;
        }
    }
    return null;
}

export function isLet(d: ts.VariableDeclaration): boolean {
    return Boolean(d.parent && (d.parent.flags & typescript.NodeFlags.Let));
}

export const assignmentMemo = new WeakMap<ts.VariableDeclaration, ts.Expression[]>();

/** Right-hand sides assigned to a `let` in its scope. */
export function assignmentsOf(d: ts.VariableDeclaration, sym: ts.Symbol, checker: ts.TypeChecker): ts.Expression[] {
    const canonical = checker.getSymbolAtLocation(d.name) ?? sym;
    const scope = d.parent?.parent?.parent;
    if (!scope || !isLet(d)) {
        return [];
    }
    const memo = assignmentMemo.get(d);
    if (memo) {
        return memo;
    }
    const out: ts.Expression[] = [];
    assignmentMemo.set(d, out);
    const visit = (n: ts.Node) => {
        if (typescript.isBinaryExpression(n) && n.operatorToken.kind === typescript.SyntaxKind.EqualsToken && typescript.isIdentifier(n.left) && checker.getSymbolAtLocation(n.left) === canonical) {
            out.push(n.right);
        }
        typescript.forEachChild(n, visit);
    };
    visit(scope);
    return out;
}

/** The values pushed onto a local array (`const items = []; items.push(<Menu.Item …/>)`), in the declaring scope. */
export function pushesOf(d: ts.VariableDeclaration, sym: ts.Symbol, checker: ts.TypeChecker): ts.Expression[] {
    const scope = d.parent?.parent?.parent;
    if (!scope) {
        return [];
    }
    const out: ts.Expression[] = [];
    const visit = (n: ts.Node) => {
        if (typescript.isCallExpression(n) && typescript.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'push' &&
            typescript.isIdentifier(n.expression.expression) && checker.getSymbolAtLocation(n.expression.expression) === sym) {
            out.push(...n.arguments);
        }
        typescript.forEachChild(n, visit);
    };
    visit(scope);
    return out;
}

export function attrValueOf(tag: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string): ts.Expression | undefined {
    const a = tag.attributes.properties.find((p): p is ts.JsxAttribute => typescript.isJsxAttribute(p) && p.name.getText() === name);
    return a?.initializer && typescript.isJsxExpression(a.initializer) ? a.initializer.expression : undefined;
}

export function isHocCall(call: ts.CallExpression): boolean {
    const t = call.expression.getText();
    return (/(^|\.)(memo|forwardRef|connect|injectIntl|withRouter|observer)$/).test(t) || typescript.isCallExpression(call.expression);
}

/** The string literals of a literal union type (undefined/null members ignored), or null. */
export function stringLiteralsOf(t: ts.Type, depth = 0): string[] | null {
    if (depth > MAX_RESOLVE_DEPTH) {
        return null;
    }
    if (t.isStringLiteral()) {
        return [t.value];
    }
    if (t.isUnion()) {
        const members = t.types.filter((member) => !(member.flags & (typescript.TypeFlags.Undefined | typescript.TypeFlags.Null)));
        const values = members.map((member) => stringLiteralsOf(member, depth + 1));
        if (values.every((value) => value !== null)) {
            const result = [...new Set(values.flat())];
            return result.length && result.length <= MAX_TEMPLATE_VALUES ? result : null;
        }
    }
    if (t.flags & typescript.TypeFlags.TemplateLiteral) {
        const template = t as ts.TemplateLiteralType;
        let values = [template.texts[0]];
        for (let index = 0; index < template.types.length; index++) {
            const type = template.types[index];
            const members = type.flags & typescript.TypeFlags.NumberLiteral ? [String((type as ts.NumberLiteralType).value)] : stringLiteralsOf(type, depth + 1);
            if (!members || values.length * members.length > MAX_TEMPLATE_VALUES) {
                return null;
            }
            values = values.flatMap((prefix) => members.map((member) => prefix + member + template.texts[index + 1]));
        }
        return [...new Set(values)];
    }
    return null;
}

/** The interface or type alias a property is declared in (`type FileInfo = {id: string}` -> `FileInfo`). */
export function namedTypeOf(d: ts.Declaration): {name: string; decl: ts.Declaration} | null {
    const parent = d.parent;
    if (typescript.isInterfaceDeclaration(parent)) {
        return {name: parent.name.text, decl: parent};
    }
    if (typescript.isTypeLiteralNode(parent) && typescript.isTypeAliasDeclaration(parent.parent)) {
        return {name: parent.parent.name.text, decl: parent.parent};
    }
    return null;
}

export function enclosingFunction(n: ts.Node): ts.Node | null {
    for (let p = n.parent; p; p = p.parent) {
        if (isFunctionLike(p)) {
            return p;
        }
    }
    return null;
}

/** Resolve shorthand properties to their value symbol. */
export function symbolOf(checker: ts.TypeChecker, n: ts.Node): ts.Symbol | undefined {
    if (n.parent && typescript.isShorthandPropertyAssignment(n.parent) && n.parent.name === n) {
        return checker.getShorthandAssignmentValueSymbol(n.parent);
    }
    return checker.getSymbolAtLocation(n);
}
