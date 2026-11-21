// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {evalStr, flatten} from './walker.mjs';
import {compactText} from './strings.mjs';
import {isFunctionLike, lineOf, objectProp, ts, unwrap} from './ts.mjs';

const TEST_HEADS = new Set(['test', 'it', 'specify']);
const DESCRIBE_HEADS = new Set(['describe', 'context']);
const HOOKS = new Set(['before', 'beforeAll', 'beforeEach', 'after', 'afterAll', 'afterEach']);
const SKIP_MODS = new Set(['skip', 'fixme']);
const LOOP_METHODS = new Set(['forEach', 'map', 'each', 'flatMap']);

function calleeNames(call) {
    const {root, segs} = flatten(call.expression);
    const names = [];
    if (ts.isIdentifier(root)) {
        names.push(root.text);
    } else {
        return null;
    }
    for (const s of segs) {
        if (s.kind !== 'prop') {
            return null;
        }
        names.push(s.name);
    }
    return names;
}

export function classifyCall(call) {
    if (!ts.isCallExpression(call)) {
        return null;
    }
    const names = calleeNames(call);
    if (!names) {
        return null;
    }
    const [head, ...mods] = names;
    const skipped = mods.some((m) => SKIP_MODS.has(m)) || head === 'xit' || head === 'xdescribe' || head === 'xcontext';
    if (HOOKS.has(head) && mods.length === 0) {
        return {kind: 'hook', hook: head};
    }
    if (TEST_HEADS.has(head) || head === 'xit' || head === 'fit') {
        if (mods.length && HOOKS.has(mods[0])) {
            return {kind: 'hook', hook: mods[0]};
        }
        if (mods[0] === 'describe') {
            return {kind: 'describe', skipped};
        }
        if (mods.every((m) => ['skip', 'only', 'fixme', 'fail', 'slow'].includes(m))) {
            const args = [...call.arguments].map(unwrap);
            const first = args[0];
            const titleLike =
                first &&
                (ts.isStringLiteralLike(first) || ts.isTemplateExpression(first) || ts.isBinaryExpression(first));
            const hasFn = args.some((a) => isFunctionLike(a));
            const identFn = mods.length === 0 && args.length >= 2 && args.slice(1).some(ts.isIdentifier);
            const pending = mods.length === 0 && head !== 'test' && args.length === 1;
            if ((titleLike || (hasFn && mods.length === 0 && args.length >= 2)) && (hasFn || identFn || pending)) {
                return {kind: 'test', skipped: skipped || pending};
            }
        }
        return null;
    }
    if (DESCRIBE_HEADS.has(head) || head === 'fdescribe' || head === 'xdescribe' || head === 'xcontext') {
        if (mods.every((m) => ['skip', 'only', 'fixme', 'serial', 'parallel'].includes(m))) {
            return {kind: 'describe', skipped};
        }
    }
    return null;
}

function titleOf(node, ctx) {
    if (!node) {
        return {text: '', dyn: false};
    }
    return evalStr(node, ctx);
}

function tagsFromOptions(args, ctx) {
    const tags = [];
    for (const a of args) {
        const n = unwrap(a);
        if (n && ts.isObjectLiteralExpression(n)) {
            const t = objectProp(n, 'tag');
            const tn = t && unwrap(t);
            if (tn && ts.isArrayLiteralExpression(tn)) {
                tn.elements.forEach((e) => tags.push(evalStr(e, ctx).text));
            } else if (tn) {
                tags.push(evalStr(tn, ctx).text);
            }
        }
    }
    return tags.filter((t) => t.startsWith('@'));
}

export function discoverTests(info, ctxFor) {
    const found = [];
    const ctx = ctxFor();

    const visitBody = (body, scope) => {
        const hooks = {before: [], beforeEach: []};
        const stmts = ts.isBlock(body) || ts.isSourceFile(body) ? body.statements : [body];
        for (const st of stmts) {
            if (ts.isExpressionStatement(st) && ts.isCallExpression(unwrap(st.expression))) {
                const c = classifyCall(unwrap(st.expression));
                if (c?.kind === 'hook') {
                    const fn = [...unwrap(st.expression).arguments].map(unwrap).find(isFunctionLike);
                    if (fn) {
                        if (c.hook === 'before' || c.hook === 'beforeAll') {
                            hooks.before.push(fn);
                        } else if (c.hook === 'beforeEach') {
                            hooks.beforeEach.push(fn);
                        }
                    }
                }
            }
        }
        const sub = {
            ...scope,
            hooks: {
                before: [...scope.hooks.before, ...hooks.before],
                beforeEach: [...scope.hooks.beforeEach, ...hooks.beforeEach],
            },
        };
        if (ts.isBlock(body) || ts.isSourceFile(body)) {
            sub.blockNodes = [...scope.blockNodes, body];
        }
        return sub;
    };

    const visit = (node, scope) => {
        if (ts.isCallExpression(node)) {
            const c = classifyCall(node);
            if (c?.kind === 'describe') {
                const fn = [...node.arguments].map(unwrap).find(isFunctionLike);
                const title = titleOf(node.arguments[0], ctx);
                const tags = tagsFromOptions(node.arguments, ctx);
                if (fn?.body) {
                    const next = visitBody(fn.body, {
                        ...scope,
                        describe: [...scope.describe, title.text],
                        tags: [...scope.tags, ...tags],
                        skipped: scope.skipped || c.skipped,
                        dynamicDescribe: scope.dynamicDescribe || title.dyn,
                    });
                    visit(fn.body, next);
                }
                return;
            }
            if (c?.kind === 'test') {
                const args = [...node.arguments];
                let fn = args.map(unwrap).find(isFunctionLike);
                let unresolved = false;
                if (!fn) {
                    const ident = args.map(unwrap).slice(1).find(ts.isIdentifier);
                    fn = ident && info.functions.get(ident.text);
                    unresolved = !fn;
                }
                found.push({
                    call: node,
                    title: titleOf(args[0], ctx),
                    fn,
                    unresolved,
                    scope,
                    tags: [...scope.tags, ...tagsFromOptions(args, ctx)],
                    skipped: scope.skipped || c.skipped,
                });
                return;
            }
            if (c?.kind === 'hook') {
                return;
            }
            const loopy =
                ts.isPropertyAccessExpression(unwrap(node.expression)) &&
                LOOP_METHODS.has(unwrap(node.expression).name.text);
            if (loopy) {
                node.arguments.forEach((a) => visit(a, {...scope, loop: true}));
                visit(node.expression, scope);
                return;
            }
        }
        if (
            ts.isForStatement(node) ||
            ts.isForOfStatement(node) ||
            ts.isForInStatement(node) ||
            ts.isWhileStatement(node)
        ) {
            ts.forEachChild(node, (c) => visit(c, {...scope, loop: true}));
            return;
        }
        ts.forEachChild(node, (c) => visit(c, scope));
    };

    const root = {
        describe: [],
        tags: [],
        skipped: false,
        loop: false,
        dynamicDescribe: false,
        hooks: {before: [], beforeEach: []},
        blockNodes: [],
    };
    const rootScope = visitBody(info.sf, root);
    visit(info.sf, rootScope);
    return found;
}

export function leadingMeta(info, call) {
    let stmt = call;
    while (stmt.parent && !ts.isExpressionStatement(stmt) && !ts.isSourceFile(stmt.parent)) {
        stmt = stmt.parent;
    }
    const ranges = ts.getLeadingCommentRanges(info.text, stmt.getFullStart()) ?? [];
    const comments = ranges.map((r) => info.text.slice(r.pos, r.end));
    let objective;
    for (const c of comments) {
        const m = /@objective\s+([\s\S]*?)(?=\n\s*\*?\s*@\w|\*\/|$)/.exec(c);
        if (m) {
            objective = compactText(m[1].replace(/\n\s*\*\s?/g, ' '), 400);
        }
    }
    return {objective, comments: comments.join('\n')};
}

export function narrativeOf(info, fn) {
    if (!fn) {
        return [];
    }
    const start = fn.getStart(info.sf);
    const end = fn.getEnd();
    const startLine = lineOf(info.sf, fn);
    const text = info.text.slice(start, end);
    const out = [];
    text.split('\n').forEach((line, i) => {
        const m = /^\s*\/\/\s*([#*])\s+(.*\S)\s*$/.exec(line);
        if (m && out.length < 40) {
            out.push({line: startLine + i, kind: m[1], text: compactText(m[2], 140)});
        }
    });
    return out;
}
