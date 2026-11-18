// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {enclosingFunction} from './type_utils.ts';
import type {Value} from './types.ts';

import {isFunctionLike} from '../ast.ts';
import type {ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';

type Guard = {expr: ts.Expression; when: boolean};
type Write = {node: ts.Node; symbols: Set<ts.Symbol>; property: boolean; fn: ts.Node | null};
type Effects = {writes: Write[]; calls: Array<{node: ts.Node; fn: ts.Node | null}>};

/** Surrounding branch guards apply to a testid only while their references remain stable. */
export class SiteGuards {
    private readonly ix: ProgramIndex;
    private readonly apply: (guard: Guard, evaluate: () => Value[]) => Value[];
    private readonly effects = new WeakMap<ts.Node, Effects>();

    constructor(ix: ProgramIndex, apply: (guard: Guard, evaluate: () => Value[]) => Value[]) {
        this.ix = ix;
        this.apply = apply;
    }

    /** Resolve within enclosing runtime branches, crossing transparent syntax but never deferred bodies. */
    resolve(node: ts.Node, evaluate: () => Value[]): Value[] {
        const guards: Guard[] = [];
        for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
            if (isFunctionLike(parent) || typescript.isClassLike(parent)) {
                break;
            }
            if (typescript.isIfStatement(parent) && child !== parent.expression) {
                guards.push({expr: parent.expression, when: child === parent.thenStatement});
            } else if (typescript.isConditionalExpression(parent) && child !== parent.condition) {
                guards.push({expr: parent.condition, when: child === parent.whenTrue});
            } else if (typescript.isBinaryExpression(parent) && child === parent.right) {
                if (parent.operatorToken.kind === typescript.SyntaxKind.AmpersandAmpersandToken) {
                    guards.push({expr: parent.left, when: true});
                } else if (parent.operatorToken.kind === typescript.SyntaxKind.BarBarToken) {
                    guards.push({expr: parent.left, when: false});
                }
            }
        }
        const stable = guards.filter((guard) => this.stable(guard.expr, node));
        const visit = (index: number): Value[] => (index === stable.length ? evaluate() : this.apply(stable[index], () => visit(index + 1)));
        return visit(0);
    }

    /** Canonical checker symbols let writes through typed property aliases invalidate the same reference. */
    private addSymbol(node: ts.Node, into: Set<ts.Symbol>): void {
        let symbol = this.ix.checker.getSymbolAtLocation(node);
        if (symbol && (symbol.flags & typescript.SymbolFlags.Alias)) {
            symbol = this.ix.checker.getAliasedSymbol(symbol);
        }
        if (symbol) {
            for (const root of this.ix.checker.getRootSymbols(symbol)) {
                into.add(root);
            }
        }
    }

    /** Collect referenced bindings, including a property's base so rebinding that base is visible. */
    private references(node: ts.Node): {symbols: Set<ts.Symbol>; property: boolean} {
        const symbols = new Set<ts.Symbol>();
        let property = false;
        const visit = (current: ts.Node) => {
            if (typescript.isIdentifier(current) || typescript.isPropertyAccessExpression(current) || typescript.isElementAccessExpression(current)) {
                this.addSymbol(current, symbols);
            }
            if (typescript.isPropertyAccessExpression(current) || typescript.isElementAccessExpression(current)) {
                property = true;
            }
            typescript.forEachChild(current, visit);
        };
        visit(node);
        return {symbols, property};
    }

    /** Index binding writes and possible property-mutating calls once per lexical owner. */
    private effectsOf(scope: ts.Node): Effects {
        const hit = this.effects.get(scope);
        if (hit) {
            return hit;
        }
        const out: Effects = {writes: [], calls: []};
        const visit = (node: ts.Node) => {
            let target: ts.Node | undefined;
            if (typescript.isBinaryExpression(node) && node.operatorToken.kind >= typescript.SyntaxKind.FirstAssignment && node.operatorToken.kind <= typescript.SyntaxKind.LastAssignment) {
                target = node.left;
            } else if ((typescript.isPrefixUnaryExpression(node) || typescript.isPostfixUnaryExpression(node)) && (node.operator === typescript.SyntaxKind.PlusPlusToken || node.operator === typescript.SyntaxKind.MinusMinusToken)) {
                target = node.operand;
            } else if (typescript.isDeleteExpression(node)) {
                target = node.expression;
            }
            if (target) {
                const symbols = new Set<ts.Symbol>();
                let property = false;
                const write = (part: ts.Node) => {
                    this.addSymbol(part, symbols);
                    if (typescript.isShorthandPropertyAssignment(part)) {
                        const symbol = this.ix.checker.getShorthandAssignmentValueSymbol(part);
                        if (symbol) {
                            for (const root of this.ix.checker.getRootSymbols(symbol)) {
                                symbols.add(root);
                            }
                        }
                    }
                    if (typescript.isPropertyAccessExpression(part) || typescript.isElementAccessExpression(part)) {
                        property = true;
                    }
                    if (!(typescript.isPropertyAccessExpression(part) || typescript.isElementAccessExpression(part))) {
                        typescript.forEachChild(part, write);
                    }
                };
                write(target);
                out.writes.push({node, symbols, property, fn: enclosingFunction(node)});
            }
            if (typescript.isCallExpression(node) || typescript.isNewExpression(node)) {
                out.calls.push({node, fn: enclosingFunction(node)});
            }
            typescript.forEachChild(node, visit);
        };
        visit(scope);
        this.effects.set(scope, out);
        return out;
    }

    /** A guard cannot narrow across an intervening write, deferred writer, getter or unknown property mutation. */
    stable(condition: ts.Expression, site: ts.Node): boolean {
        const fn = enclosingFunction(condition);
        if (fn !== enclosingFunction(site)) {
            return false;
        }
        const {symbols, property} = this.references(condition);
        const scopes = new Set<ts.Node>([fn ?? condition.getSourceFile()]);
        for (const symbol of symbols) {
            for (const declaration of symbol.declarations ?? []) {
                if (typescript.isGetAccessorDeclaration(declaration)) {
                    return false;
                }
                if (typescript.isVariableDeclaration(declaration) || typescript.isBindingElement(declaration) || typescript.isParameter(declaration) || typescript.isPropertyDeclaration(declaration)) {
                    scopes.add(enclosingFunction(declaration) ?? declaration.getSourceFile());
                }
            }
        }
        const loops: ts.Node[] = [];
        for (let parent = site.parent; parent && parent !== fn; parent = parent.parent) {
            if (parent.getStart() < condition.end) {
                break;
            }
            if (typescript.isForStatement(parent) || typescript.isForOfStatement(parent) || typescript.isForInStatement(parent) || typescript.isWhileStatement(parent) || typescript.isDoStatement(parent)) {
                loops.push(parent);
            }
        }
        const between = (node: ts.Node) => (node.getStart() >= condition.end && node.end <= site.getStart()) || loops.some((loop) => node.pos >= loop.pos && node.end <= loop.end);
        for (const scope of scopes) {
            const effects = this.effectsOf(scope);
            const calledBetween = effects.calls.some((call) => call.fn === fn && between(call.node));
            for (const write of effects.writes) {
                if (((write.fn !== fn && calledBetween) || (write.fn === fn && between(write.node))) && ((property && write.property) || [...write.symbols].some((symbol) => symbols.has(symbol)))) {
                    return false;
                }
            }
            if (property && calledBetween) {
                return false;
            }
        }
        return true;
    }
}
