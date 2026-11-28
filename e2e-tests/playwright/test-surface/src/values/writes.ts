// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {isGlobalObject} from './type_utils.ts';

import {enclosingFunction, isFunctionLike, strip} from '../ast.ts';
import {MAX_RESOLVE_DEPTH} from '../limits.ts';
import type {ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';

/** What telling reads from writes needs: symbols, the functions a call reaches, and the standard library's `Object`. */
export type WriteDeps = Pick<ProgramIndex, 'checker' | 'program' | 'symbolAt' | 'unwrapExpr' | 'isLibraryNode'>;

/**
 * Whether every reference to a record in its declaring scope only reads it: an element read (`byArea[area]`,
 * `byArea[k].push(…)` changes a value, not the keys), `Object.keys/entries/values(byArea)`, a pass to an in-repo
 * function whose parameter only reads it in turn, or the binding a for-of reads. An element write, an alias, a
 * return or any other use does not.
 */
export function onlyReads(ix: WriteDeps, symbol: ts.Symbol, declaration: ts.Declaration, depth: number): boolean {
    if (depth > MAX_RESOLVE_DEPTH) {
        return false;
    }
    const scope = typescript.findAncestor(declaration.parent, (node) => isFunctionLike(node) || typescript.isSourceFile(node)) ?? declaration.getSourceFile();
    const name = (declaration as ts.NamedDeclaration).name;
    let reads = true;
    const visit = (node: ts.Node) => {
        if (!reads) {
            return;
        }
        if (typescript.isIdentifier(node) && node !== name && ix.symbolAt(node) === symbol) {
            reads = readUse(ix, node, depth);
        }
        typescript.forEachChild(node, visit);
    };
    visit(scope);
    return reads;
}

/** Check whether a record reference only reads its keys or passes it to another read-only helper. */
function readUse(ix: WriteDeps, reference: ts.Identifier, depth: number): boolean {
    const parent = reference.parent;
    if (typescript.isElementAccessExpression(parent) && parent.expression === reference) {
        const target = parent.parent;
        const written = (typescript.isBinaryExpression(target) && target.left === parent && target.operatorToken.kind >= typescript.SyntaxKind.FirstAssignment && target.operatorToken.kind <= typescript.SyntaxKind.LastAssignment) || typescript.isDeleteExpression(target);
        return !written;
    }
    if (!typescript.isCallExpression(parent) || !parent.arguments.includes(reference)) {
        return false;
    }
    const callee = strip(parent.expression);
    if (typescript.isPropertyAccessExpression(callee) && typescript.isIdentifier(callee.expression) && callee.expression.text === 'Object' && isGlobalObject(ix, callee.expression)) {
        return ['keys', 'entries', 'values'].includes(callee.name.text);
    }
    const fn = ix.unwrapExpr(parent.expression);
    const index = parent.arguments.indexOf(reference);
    const parameter = fn && isFunctionLike(fn) && !ix.isLibraryNode(fn) ? fn.parameters[index] : undefined;
    const parameterSymbol = parameter && typescript.isIdentifier(parameter.name) ? ix.symbolAt(parameter.name) : undefined;
    return Boolean(parameter && parameterSymbol && onlyReads(ix, parameterSymbol, parameter, depth + 1));
}

/** Only a preceding write on the same ordinary execution path can remove an unassigned alternative. */
export function writeCanEstablishAssignment(rhs: ts.Expression, reference: ts.Identifier, declaration: ts.VariableDeclaration): boolean {
    if (enclosingFunction(rhs) !== enclosingFunction(declaration) || enclosingFunction(reference) !== enclosingFunction(declaration) || rhs.getStart() >= reference.getStart()) {
        return false;
    }
    const scope = declaration.parent?.parent?.parent;
    for (let child: ts.Node = rhs, parent = rhs.parent; parent; child = parent, parent = parent.parent) {
        if (parent === scope) {
            return true;
        }

        // A whitelist proves straight-line execution; every other context may skip or defer this write.
        if (!(typescript.isExpressionStatement(parent) || typescript.isBlock(parent) || typescript.isParenthesizedExpression(parent) ||
            (typescript.isBinaryExpression(parent) && parent.operatorToken.kind === typescript.SyntaxKind.EqualsToken && child === parent.right))) {
            return false;
        }
    }
    return false;
}
