// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Whether two testid sites can render together: the one real analysis behind the duplicates rule. Two sites are
 * exclusive when they sit in different arms of a branch (ternary, if/else, early return, switch, contradicting
 * guards), compared along their usage chains, through caller-built elements rendered at a prop read, and through
 * the calls that run single-use render helpers.
 */

import type ts from 'typescript';

import {commonAncestor, enclosingFunctionLike, peelNot} from '../ast.ts';
import {guardsAround} from '../conditions.ts';
import type {Loc} from '../manifest_types.ts';
import {alwaysReturns} from '../scan/elements.ts';
import type {Emission, ScanResult} from '../scan.ts';
import {typescript} from '../typescript.ts';

/**
 * Two emissions are exclusive when, at the first file their usage chains share, the nodes they render
 * through sit in different branches (`flag ? <A/> : <B/>`, an early return before one of them).
 */
export function exclusiveAlongChains(a: Emission, b: Emission, usageNodeAt: (loc: Loc) => ts.Node | undefined, propUses: ScanResult['propRenderUses'], uniqueMountChain?: ScanResult['uniqueMountChain']): boolean {
    const chain = (e: Emission) => {
        const nodes = [e.site.node, ...e.via.map(usageNodeAt).filter((node): node is ts.Node => Boolean(node))];
        return [...nodes, ...(uniqueMountChain?.(nodes[nodes.length - 1]) ?? [])];
    };
    const ca = chain(a);
    const cb = chain(b);

    // A caller-built element renders at the receiver's prop read, not at its creation position.
    const throughProp = (left: ts.Node[], right: ts.Node[]) => right.some((mount, index) => {
        const uses = left.map((creation) => propUses(creation, mount)).find((nodes) => nodes?.length);
        if (!uses) {
            return false;
        }
        const outer = right.slice(index + 1);
        const shared = left.filter((node) => outer.includes(node));
        if (outer.length && !shared.length) {
            return false;
        }
        const targets = right.slice(0, index);
        return targets.some((target) => uses.every((use) => enclosingFunctionLike(use) === enclosingFunctionLike(target) && exclusive(use, target)));
    });
    if (throughProp(ca, cb) || throughProp(cb, ca)) {
        return true;
    }
    for (const x of ca) {
        for (const y of cb.filter((node) => node.getSourceFile() === x.getSourceFile())) {
            if (x === y) {
                return false;
            }
            if (exclusive(x, y)) {
                return true;
            }

            // render helpers (`createDMIntro()` in one arm, `createGMIntro()` in another): compare the calls that lead to each, within one function
            const lx = helperCalls(x);
            const ly = helperCalls(y);
            if (lx.some((p) => ly.some((q) => p !== q && enclosingFunctionLike(p) === enclosingFunctionLike(q) && exclusive(p, q)))) {
                return true;
            }
        }
    }
    return false;
}

/** The name of a plain render helper declared by `fn` (`function intro()`, `const intro = () =>`, a class method), else undefined. */
function helperName(fn: ts.Node): ts.Identifier | undefined {
    if ((typescript.isFunctionDeclaration(fn) || typescript.isMethodDeclaration(fn)) && fn.name && typescript.isIdentifier(fn.name)) {
        return fn.name;
    }
    if ((typescript.isArrowFunction(fn) || typescript.isFunctionExpression(fn)) && (typescript.isVariableDeclaration(fn.parent) || typescript.isPropertyDeclaration(fn.parent)) && typescript.isIdentifier(fn.parent.name)) {
        return fn.parent.name;
    }
    return undefined;
}

const referencesByFile = new WeakMap<ts.SourceFile, Map<string, ts.Identifier[]>>();

function referencesTo(name: ts.Identifier): ts.Identifier[] {
    const sf = name.getSourceFile();
    let refs = referencesByFile.get(sf);
    if (!refs) {
        const m = new Map<string, ts.Identifier[]>();
        const v = (n: ts.Node) => {
            if (typescript.isIdentifier(n)) {
                m.set(n.text, [...(m.get(n.text) ?? []), n]);
            }
            typescript.forEachChild(n, v);
        };
        v(sf);
        refs = m;
        referencesByFile.set(sf, refs);
    }
    return (refs.get(name.text) ?? []).filter((r) => r !== name);
}

/**
 * `n`, then the call that runs the render helper it sits in, and that helper's caller, and so on: only while
 * the helper's one reference in its file is a call (`intro()` / `this.intro()`), so a helper used twice, or
 * passed along, stops the walk.
 */
function helperCalls(n: ts.Node): ts.Node[] {
    const out = [n];
    const seen = new Set<ts.Node>();
    for (let fn = enclosingFunctionLike(n); fn && !seen.has(fn); fn = enclosingFunctionLike(out[out.length - 1])) {
        seen.add(fn);
        const name = helperName(fn);
        const refs = name ? referencesTo(name) : [];
        if (refs.length !== 1) {
            break;
        }
        const ref = refs[0];
        const callee = typescript.isPropertyAccessExpression(ref.parent) && ref.parent.name === ref && ref.parent.expression.kind === typescript.SyntaxKind.ThisKeyword ? ref.parent : ref;
        if (!typescript.isCallExpression(callee.parent) || callee.parent.expression !== callee) {
            break;
        }
        out.push(callee.parent);
    }
    return out;
}

/**
 * Whether `node` renders only by returning from inside `container`: a `return` holds it with no function between
 * that return and the container, so it leaves the container's own function (a return inside a callback leaves the
 * callback, which may run anywhere).
 */
function returnedFrom(node: ts.Node, container: ts.Node): boolean {
    let returned = false;
    for (let n: ts.Node | undefined = node; n && n !== container; n = n.parent) {
        if (typescript.isFunctionLike(n)) {
            returned = false;
        } else if (typescript.isReturnStatement(n)) {
            returned = true;
        }
    }
    return returned;
}

/** Whether two nodes sit in one JSX tree: their nearest common ancestor is a JSX element or fragment. */
export function inOneJsxTree(a: ts.Node, b: ts.Node): boolean {
    const common = commonAncestor(a, b);
    return Boolean(common) && (typescript.isJsxElement(common!) || typescript.isJsxFragment(common!));
}

/** Whether two nodes in one file are in different arms of a branch (ternary, if/else, early return, switch). */
export function exclusive(a: ts.Node, b: ts.Node): boolean {
    const c = commonAncestor(a, b);
    if (!c) {
        return false;
    }
    const armOf = (x: ts.Node) => {
        let n = x;
        while (n.parent && n.parent !== c) {
            n = n.parent;
        }
        return n;
    };
    if (typescript.isConditionalExpression(c)) {
        const aa = armOf(a);
        const bb = armOf(b);
        return aa !== bb && aa !== c.condition && bb !== c.condition;
    }
    if (typescript.isIfStatement(c)) {
        const aa = armOf(a);
        const bb = armOf(b);
        return aa !== bb && aa !== c.expression && bb !== c.expression;
    }
    if (typescript.isBlock(c) || typescript.isSourceFile(c) || typescript.isCaseClause(c)) {
        const sa = armOf(a);
        const sb = armOf(b);

        // an earlier `if` the later statement can't run with: the earlier node renders only by returning from inside
        // it, or the arm holding it always leaves. A return elsewhere in the `if` that may be skipped doesn't count.
        const [first, earlier] = sa.pos < sb.pos ? [sa, a] : [sb, b];
        if (typescript.isIfStatement(first)) {
            const arm = [first.thenStatement, first.elseStatement].find((st) => st && earlier.pos >= st.pos && earlier.end <= st.end);
            if (returnedFrom(earlier, first) || (arm && alwaysReturns(arm))) {
                return true;
            }
        }
    }
    if (typescript.isCaseBlock(c)) {
        // exclusive unless the earlier clause runs on into the later one
        const [ca, cb] = [armOf(a), armOf(b)];
        const earlier = ca.pos < cb.pos ? ca : cb;
        return !typescript.isCaseOrDefaultClause(earlier) || leavesClause(earlier.statements[earlier.statements.length - 1]);
    }

    // guarded by contradicting conditions: `if (!compact) {…}` and `else if (archived && compact) {…}`
    if (contradict(guards(a, c), guards(b, c))) {
        return true;
    }

    // different functions of one component (e.g. render helpers chosen by a switch) count as exclusive only via the above
    return false;
}

/** A statement after which a switch clause does not run on into the next: `break`, `continue`, `return`, `throw`, or a block or `if`/`else` that ends in one. */
function leavesClause(st: ts.Statement | undefined): boolean {
    if (!st) {
        return false;
    }
    if (typescript.isBreakStatement(st) || typescript.isContinueStatement(st) || typescript.isReturnStatement(st) || typescript.isThrowStatement(st)) {
        return true;
    }
    if (typescript.isBlock(st)) {
        return leavesClause(st.statements[st.statements.length - 1]);
    }
    return typescript.isIfStatement(st) && leavesClause(st.thenStatement) && leavesClause(st.elseStatement);
}

type Atom = {text: string; neg: boolean};

/** The conditions a node runs under, below `stop`, as atoms: `a && !b` in a then-arm gives a, !b; an else-arm negates a single atom. */
function guards(n: ts.Node, stop: ts.Node): Atom[] {
    const out: Atom[] = [];
    const atom = (e: ts.Expression, neg: boolean): Atom => {
        const {expr, negated} = peelNot(e, {parensOnly: true});
        return {text: expr.getText(), neg: neg !== negated};
    };
    const conjuncts = (e: ts.Expression): ts.Expression[] => {
        const x = typescript.isParenthesizedExpression(e) ? e.expression : e;
        return typescript.isBinaryExpression(x) && x.operatorToken.kind === typescript.SyntaxKind.AmpersandAmpersandToken ? [...conjuncts(x.left), ...conjuncts(x.right)] : [x];
    };
    for (const guard of guardsAround(n, {stop: (_parent, child) => child === stop})) {
        if (guard.when) {
            out.push(...conjuncts(guard.expr).map((e) => atom(e, false)));
        } else if (typescript.isIfStatement(guard.at) && conjuncts(guard.expr).length === 1) {
            out.push(atom(guard.expr, true));
        }
    }
    return out;
}

function contradict(a: Atom[], b: Atom[]): boolean {
    return a.some((x) => b.some((y) => x.text === y.text && x.neg !== y.neg));
}
