// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {isFunctionLike, isNot, nameOfFunction, shortText} from './ast.ts';
import {MAX_CONDITION_INLINE_DEPTH} from './limits.ts';
import type {ConditionKind, RenderCondition} from './manifest_types.ts';
import type {ProgramIndex} from './program_index.ts';
import {typescript} from './typescript.ts';
import type {Resolver} from './values/index.ts';

type RawCondition = {expr: ts.Expression; negate: boolean; at: ts.Node};

/** A condition a node runs under: `expr` is truthy (`when`) or falsy (`!when`); `nullish`: `expr` is null or undefined. `at` is the branch or statement that tests it. */
export type Guard = {expr: ts.Expression; when: boolean; at: ts.Node; nullish?: true};

export type GuardOptions = {

    /** Leave the walk before `parent` and everything above it. */
    stop: (parent: ts.Node, child: ts.Node) => boolean;

    /** `a || <node>`: the node runs when `a` is falsy. */
    orElse?: boolean;

    /** `a ?? <node>`: the node runs when `a` is nullish. */
    nullish?: boolean;

    /**
     * An earlier `if (x) …` in an enclosing block that `test` says leaves it: what follows runs when `x` is falsy.
     * With `functionBodyOnly`, only the blocks that are a function's body count.
     */
    earlyExits?: {test: (statement: ts.IfStatement) => boolean; functionBodyOnly?: boolean};
};

/** The branch conditions around a node, innermost first: if/else arms, ternary arms, `a && <node>`, and what `options` adds. */
export function guardsAround(node: ts.Node, options: GuardOptions): Guard[] {
    const out: Guard[] = [];
    for (let child = node, parent = node.parent; parent && !options.stop(parent, child); child = parent, parent = parent.parent) {
        if (typescript.isIfStatement(parent) && child !== parent.expression) {
            out.push({expr: parent.expression, when: child === parent.thenStatement, at: parent});
        } else if (typescript.isConditionalExpression(parent) && child !== parent.condition) {
            out.push({expr: parent.condition, when: child === parent.whenTrue, at: parent});
        } else if (typescript.isBinaryExpression(parent) && child === parent.right) {
            const op = parent.operatorToken.kind;
            if (op === typescript.SyntaxKind.AmpersandAmpersandToken) {
                out.push({expr: parent.left, when: true, at: parent});
            } else if (op === typescript.SyntaxKind.BarBarToken && options.orElse) {
                out.push({expr: parent.left, when: false, at: parent});
            } else if (op === typescript.SyntaxKind.QuestionQuestionToken && options.nullish) {
                out.push({expr: parent.left, when: true, nullish: true, at: parent});
            }
        } else if (options.earlyExits && typescript.isBlock(parent) && (!options.earlyExits.functionBodyOnly || (isFunctionLike(parent.parent) && parent.parent.body === parent))) {
            for (const statement of parent.statements) {
                if (statement === child) {
                    break;
                }
                if (typescript.isIfStatement(statement) && options.earlyExits.test(statement)) {
                    out.push({expr: statement.expression, when: false, at: statement});
                }
            }
        }
    }
    return out;
}

function exits(statement: ts.Statement): boolean {
    if (typescript.isReturnStatement(statement) || typescript.isThrowStatement(statement)) {
        return true;
    }
    if (typescript.isBlock(statement)) {
        return statement.statements.some(exits);
    }
    return typescript.isIfStatement(statement) && Boolean(statement.elseStatement) && exits(statement.thenStatement) && exits(statement.elseStatement!);
}
const ORDER: ConditionKind[] = ['permission', 'license/config/flag', 'layout', 'store selector', 'prop', 'local state'];

/** When an element renders: `cond && <el/>`, ternary arms, if/else arms, and early returns before it. */
export class Conditions {
    private readonly ix: ProgramIndex;
    private readonly R: Resolver;

    constructor(ix: ProgramIndex, R: Resolver) {
        this.ix = ix;
        this.R = R;
    }

    /** Up to the component (a capitalized or `render` function with a block body) or the class around it; early returns count in function bodies. */
    raw(el: ts.Node): RawCondition[] {
        const component = (p: ts.Node) => isFunctionLike(p) && Boolean(p.body && typescript.isBlock(p.body)) && ((/^[A-Z]/).test(nameOfFunction(p)) || (typescript.isMethodDeclaration(p) && p.name.getText() === 'render'));
        const guards = guardsAround(el, {
            stop: (parent) => typescript.isClassDeclaration(parent) || component(parent),
            earlyExits: {test: (st) => exits(st.thenStatement), functionBodyOnly: true},
        });
        return guards.map((g) => ({expr: g.expr, negate: !g.when, at: g.at}));
    }

    of(el: ts.Node): RenderCondition[] {
        return this.raw(el).filter((c) => !this.isNullGuard(c)).map((c) => {
            const {kind, viaLocal} = this.classify(c.expr);
            return {
                expr: this.text(c, false),
                explained: this.text(c, true),
                kind,
                ...(viaLocal ? {viaLocal} : {}),
                at: this.ix.where(c.at),
            };
        });
    }

    /** `channel && <X/>`: a guard that an object is loaded, not a condition worth documenting. */
    private isNullGuard(c: RawCondition): boolean {
        const e = c.expr;
        if (!typescript.isIdentifier(e) && !typescript.isPropertyAccessExpression(e)) {
            return false;
        }
        const t = this.ix.checker.getTypeAtLocation(e);
        const parts = t.isUnion() ? t.types : [t];
        return parts.every((p) => (p.flags & (typescript.TypeFlags.Object | typescript.TypeFlags.Undefined | typescript.TypeFlags.Null | typescript.TypeFlags.NonPrimitive)) !== 0) && parts.some((p) => (p.flags & typescript.TypeFlags.Object) !== 0);
    }

    /** The condition text; with `explain`, identifiers bound by useSelector(state => x) are replaced by x. */
    private text(c: RawCondition, explain: boolean): string {
        let expr = c.expr;
        let negate = c.negate;
        if (negate && isNot(expr)) {
            expr = expr.operand;
            negate = false;
        }
        while (typescript.isParenthesizedExpression(expr)) {
            expr = expr.expression;
        }
        let text = shortText(expr, 200);
        if (explain) {
            const ids: ts.Identifier[] = [];
            const w = (n: ts.Node) => {
                if (typescript.isIdentifier(n)) {
                    ids.push(n);
                }
                typescript.forEachChild(n, w);
            };
            w(expr);
            for (const id of ids) {
                const d = this.ix.checker.getSymbolAtLocation(id)?.valueDeclaration;
                if (!d || !typescript.isVariableDeclaration(d) || !d.initializer) {
                    continue;
                }
                const sel = selectorBody(d.initializer);
                if (sel) {
                    text = text.replace(new RegExp('\\b' + id.text + '\\b'), shortText(sel, 160));
                }
            }
        }
        const simple = typescript.isIdentifier(expr) || typescript.isPropertyAccessExpression(expr) || typescript.isCallExpression(expr) || typescript.isPrefixUnaryExpression(expr);
        if (!negate) {
            return text;
        }
        return simple ? `!${text}` : `!(${text})`;
    }

    /** What a condition depends on; `viaLocal` when only a local value derived from it says (`const show = canDelete && …`). */
    classify(expr: ts.Expression, depth = 0): {kind: ConditionKind; viaLocal?: true} {
        const k = this.classifyDirect(expr);
        if (k !== 'other' || depth > MAX_CONDITION_INLINE_DEPTH) {
            return {kind: k};
        }

        // inline local derived values: const showDelete = canDelete && !isSystemMessage
        const kinds: ConditionKind[] = [];
        for (const id of identifiers(expr)) {
            const d = this.ix.checker.getSymbolAtLocation(id)?.valueDeclaration;
            if (d && typescript.isVariableDeclaration(d) && d.initializer && !(/^use(State|Selector)/).test(d.initializer.getText())) {
                kinds.push(this.classify(d.initializer, depth + 1).kind);
            }
            if (typescript.isPropertyAccessExpression(id.parent) && (/^this\.state\./).test(id.parent.getText())) {
                kinds.push('local state');
            }
        }
        const found = ORDER.find((o) => kinds.includes(o));
        return found ? {kind: found, viaLocal: true} : {kind: 'other'};
    }

    private classifyDirect(expr: ts.Expression): ConditionKind {
        const t = expr.getText();
        if ((/isMobile|isDesktop|isTablet|isMobileView|isRHS|isExpanded|isCollapsed/i).test(t)) {
            return 'layout';
        }
        if ((/[Ll]icen[cs]e|isCloud|isEnterprise|isStarter|SKU|FeatureFlag|getConfig|config\.|Config\b/).test(t)) {
            return 'license/config/flag';
        }
        if ((/[Pp]ermission|canAccess|canManage|canEdit|isAdmin|haveI|isSystemAdmin|canCreate|canDelete/).test(t)) {
            return 'permission';
        }
        const ids = identifiers(expr);
        for (const id of ids) {
            const d = this.ix.checker.getSymbolAtLocation(id)?.valueDeclaration;
            if (!d) {
                continue;
            }
            if (typescript.isVariableDeclaration(d) && d.initializer) {
                const it = d.initializer.getText();
                if ((/^useSelector\(/).test(it)) {
                    if ((/[Pp]ermission|canAccess|canManage|haveI/).test(it)) {
                        return 'permission';
                    }
                    return (/[Ll]icen|Config|FeatureFlag/).test(it) ? 'license/config/flag' : 'store selector';
                }
            }
            if (typescript.isBindingElement(d) && typescript.isArrayBindingPattern(d.parent)) {
                return 'local state';
            }
        }
        if ((/this\.state\./).test(t)) {
            return 'local state';
        }
        if (this.R.props.propsPath(expr) || ids.some((id) => this.R.props.propsPath(id))) {
            return 'prop';
        }
        return 'other';
    }
}

function identifiers(expr: ts.Node): ts.Identifier[] {
    const ids: ts.Identifier[] = [];
    const w = (n: ts.Node) => {
        if (typescript.isIdentifier(n)) {
            ids.push(n);
        }
        typescript.forEachChild(n, w);
    };
    w(expr);
    return ids;
}

/** `useSelector((state) => expr)` -> expr */
function selectorBody(init: ts.Expression): ts.Expression | null {
    if (!typescript.isCallExpression(init) || init.expression.getText() !== 'useSelector') {
        return null;
    }
    const f = init.arguments[0];
    if (f && typescript.isArrowFunction(f) && !typescript.isBlock(f.body)) {
        return f.body;
    }
    return null;
}
