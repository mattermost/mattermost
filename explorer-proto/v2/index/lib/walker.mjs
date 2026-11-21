// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    MAX_EVENTS,
    MAX_VALUE_DEPTH,
    PW_LOCATOR_METHODS,
    PW_ACTIONS,
    PW_NAV,
    CY_ACTIONS,
    CY_PASSTHROUGH_NAMES,
    CY_SETUP_PREFIX,
    CY_ACTOR_CMDS,
    GLOBAL_IGNORE,
    CLIENT_NAME,
    PW_IGNORED,
} from './constants.mjs';
import {compactText, hint, isFullyDynamic, regexText, staticContent} from './strings.mjs';
import {isFunctionLike, lineOf, objectProp, propName, ts, unwrap} from './ts.mjs';

function actorKey(name, args) {
    if (name === 'apiAdminLogin') {
        return 'admin';
    }
    return args[0] ? exprText(args[0], 30) : name;
}

function exprText(node, max = 48) {
    if (!node) {
        return '';
    }
    return compactText(node.getText().replace(/[{}]/g, ''), max);
}

export class Collector {
    constructor() {
        this.actions = [];
        this.assertions = [];
        this.setup = [];
        this.actors = new Map();
        this.locators = new Set();
        this.reasons = new Set();
        this.notes = new Set();
        this.size = 0;
        this.lastLoc = null;
    }

    get full() {
        return this.size > MAX_EVENTS;
    }
}

function at(ctx, node) {
    return `${ctx.file.rel}:${lineOf(ctx.file.sf, node)}`;
}

function push(ctx, list, entry, node) {
    const col = ctx.col;
    if (col.full) {
        col.notes.add('event_cap_reached');
        return;
    }
    col.size += 1;
    entry.seq = col.size;
    entry.at = at(ctx, node);
    if (ctx.via) {
        entry.via = ctx.via;
    }
    list.push(entry);
}

const unk = (text = '') => ({t: 'unk', text});

export function flatten(expr) {
    const segs = [];
    let cur = unwrap(expr);
    for (;;) {
        if (ts.isCallExpression(cur)) {
            const callee = unwrap(cur.expression);
            if (ts.isPropertyAccessExpression(callee)) {
                segs.unshift({kind: 'call', name: callee.name.text, args: cur.arguments, node: cur});
                cur = unwrap(callee.expression);
            } else if (ts.isElementAccessExpression(callee)) {
                const arg = callee.argumentExpression;
                const name = arg && ts.isStringLiteralLike(arg) ? arg.text : '[computed]';
                segs.unshift({kind: 'call', name, args: cur.arguments, node: cur, computed: name === '[computed]'});
                cur = unwrap(callee.expression);
            } else {
                segs.unshift({kind: 'rootcall', args: cur.arguments, node: cur});
                return {root: callee, segs};
            }
        } else if (ts.isPropertyAccessExpression(cur)) {
            segs.unshift({kind: 'prop', name: cur.name.text, node: cur});
            cur = unwrap(cur.expression);
        } else if (ts.isElementAccessExpression(cur)) {
            const arg = cur.argumentExpression;
            segs.unshift({kind: 'prop', name: arg && ts.isStringLiteralLike(arg) ? arg.text : '[]', node: cur});
            cur = unwrap(cur.expression);
        } else {
            return {root: cur, segs};
        }
    }
}

export function collectLocals(root, deep = true) {
    const locals = new Map();
    const assigns = new Map();
    const visit = (node, top) => {
        if (!top && isFunctionLike(node) && !deep) {
            return;
        }
        if (ts.isClassDeclaration(node)) {
            return;
        }
        if (ts.isVariableDeclaration(node) && node.initializer) {
            if (ts.isIdentifier(node.name)) {
                locals.set(node.name.text, node.initializer);
            }
        } else if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isIdentifier(node.left)
        ) {
            if (!assigns.has(node.left.text)) {
                assigns.set(node.left.text, node.right);
            }
        }
        ts.forEachChild(node, (c) => visit(c, false));
    };
    visit(root, true);
    for (const [k, v] of assigns) {
        if (!locals.has(k)) {
            locals.set(k, v);
        }
    }
    return locals;
}

function lookupConst(ctx, name) {
    const local = ctx.locals.get(name);
    if (local) {
        return {node: local, file: ctx.file, locals: ctx.locals};
    }
    const own = ctx.file.consts.get(name);
    if (own) {
        return {node: own, file: ctx.file, locals: new Map()};
    }
    const imp = ctx.file.imports.get(name);
    if (imp) {
        const abs = ctx.repo.resolveModule(ctx.file.rel, imp.spec);
        const target = abs && ctx.repo.file(abs);
        const c = target?.consts.get(imp.imported === 'default' ? name : imp.imported);
        if (c) {
            return {node: c, file: target, locals: new Map()};
        }
    }
    return null;
}

export function evalStr(node, ctx, depth = 0) {
    const n = unwrap(node);
    if (!n) {
        return {text: '', dyn: false};
    }
    if (depth > MAX_VALUE_DEPTH) {
        return {text: hint(exprText(n, 24)), dyn: true};
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        return {text: n.text, dyn: false};
    }
    if (ts.isNumericLiteral(n)) {
        return {text: n.text, dyn: false};
    }
    if (ts.isRegularExpressionLiteral(n)) {
        return {text: regexText(n.text), dyn: false};
    }
    if (ts.isTemplateExpression(n)) {
        let text = n.head.text;
        let dyn = false;
        for (const span of n.templateSpans) {
            const s = evalStr(span.expression, ctx, depth + 1);
            text += s.text;
            dyn = dyn || s.dyn;
            text += span.literal.text;
        }
        return {text, dyn};
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const a = evalStr(n.left, ctx, depth + 1);
        const b = evalStr(n.right, ctx, depth + 1);
        return {text: a.text + b.text, dyn: a.dyn || b.dyn};
    }
    if (ts.isConditionalExpression(n)) {
        const a = evalStr(n.whenTrue, ctx, depth + 1);
        return {text: a.text, dyn: true};
    }
    if (ts.isIdentifier(n)) {
        if (n.text === 'undefined') {
            return {text: '', dyn: false};
        }
        const p = ctx.params.get(n.text);
        if (p) {
            return valueStr(p, n);
        }
        const c = lookupConst(ctx, n.text);
        if (c) {
            const sub = {...ctx, file: c.file, locals: c.locals};
            return evalStr(c.node, sub, depth + 1);
        }
        return {text: hint(n.text), dyn: true};
    }
    if (ts.isPropertyAccessExpression(n)) {
        const base = unwrap(n.expression);
        if (ts.isIdentifier(base)) {
            const c = lookupConst(ctx, base.text);
            const obj = c && unwrap(c.node);
            if (obj && ts.isObjectLiteralExpression(obj)) {
                const prop = objectProp(obj, n.name.text);
                if (prop) {
                    return evalStr(prop, {...ctx, file: c.file, locals: c.locals}, depth + 1);
                }
            }
        }
        return {text: hint(exprText(n, 32)), dyn: true};
    }
    if (ts.isCallExpression(n)) {
        const callee = unwrap(n.expression);
        if (
            ts.isPropertyAccessExpression(callee) &&
            ['toLowerCase', 'toUpperCase', 'trim', 'toString'].includes(callee.name.text)
        ) {
            const r = evalStr(callee.expression, ctx, depth + 1);
            return {text: r.text, dyn: r.dyn};
        }
        if (ts.isIdentifier(callee) && callee.text === 'String' && n.arguments[0]) {
            return evalStr(n.arguments[0], ctx, depth + 1);
        }
        return {text: hint(exprText(n, 32)), dyn: true};
    }
    return {text: hint(exprText(n, 32)), dyn: true};
}

function valueStr(v, node) {
    if (v.t === 'str') {
        return {text: v.text, dyn: v.dyn};
    }
    if (v.t === 'loc') {
        return {text: v.label, dyn: v.dyn ?? false};
    }
    return {text: hint(exprText(node, 24)), dyn: true};
}

function roleLabel(role, name) {
    return `role:${role}${name ? `[name=${name}]` : ''}`;
}

function compose(base, part) {
    return base ? `${base} > ${part}` : part;
}

function noteDynamic(ctx, what, s) {
    if (isFullyDynamic(s.text)) {
        ctx.col.reasons.add(`dynamic_locator:${what}`);
    }
}

function pwLocatorPart(ctx, name, args) {
    const a0 = args[0];
    const str = () => evalStr(a0, ctx);
    switch (name) {
        case 'getByRole': {
            const role = str();
            const opts = args[1] && unwrap(args[1]);
            const nameNode = opts && objectProp(opts, 'name');
            const nm = nameNode ? evalStr(nameNode, ctx) : null;
            if (isFullyDynamic(role.text)) {
                ctx.col.reasons.add('dynamic_locator:getByRole');
            }
            return roleLabel(role.text, nm?.text ?? '');
        }
        case 'getByText':
        case 'getByTestId':
        case 'getByLabel':
        case 'getByPlaceholder':
        case 'getByTitle':
        case 'getByAltText': {
            const s = str();
            noteDynamic(ctx, name, s);
            const kind = {
                getByText: 'text',
                getByTestId: 'testid',
                getByLabel: 'label',
                getByPlaceholder: 'placeholder',
                getByTitle: 'title',
                getByAltText: 'alt',
            }[name];
            return `${kind}:${s.text}`;
        }
        case 'locator': {
            if (a0 && ts.isCallExpression(unwrap(a0))) {
                const v = evalValue(a0, ctx, true);
                if (v.t === 'loc') {
                    return v.label;
                }
            }
            const s = str();
            noteDynamic(ctx, name, s);
            return `css:${s.text}`;
        }
        case 'frameLocator': {
            const s = str();
            noteDynamic(ctx, name, s);
            return `frame:${s.text}`;
        }
        case 'filter': {
            const opts = a0 && unwrap(a0);
            if (opts && ts.isObjectLiteralExpression(opts)) {
                const parts = [];
                const hasText = objectProp(opts, 'hasText');
                const has = objectProp(opts, 'has');
                const hasNotText = objectProp(opts, 'hasNotText');
                const hasNot = objectProp(opts, 'hasNot');
                if (hasText) {
                    parts.push(`has-text:${evalStr(hasText, ctx).text}`);
                }
                if (has) {
                    const v = evalValue(has, ctx, true);
                    parts.push(`has:(${v.t === 'loc' ? v.label : hint(exprText(has, 20))})`);
                }
                if (hasNotText) {
                    parts.push(`not-text:${evalStr(hasNotText, ctx).text}`);
                }
                if (hasNot) {
                    const v = evalValue(hasNot, ctx, true);
                    parts.push(`not:(${v.t === 'loc' ? v.label : hint(exprText(hasNot, 20))})`);
                }
                return parts.join(' ');
            }
            return '';
        }
        default:
            return '';
    }
}

function cyLocatorLabel(ctx, name, args) {
    const s0 = args[0] ? evalStr(args[0], ctx) : {text: '', dyn: false};
    const find = (kind) => {
        noteDynamic(ctx, name, s0);
        return `${kind}:${s0.text}`;
    };
    switch (name) {
        case 'get':
            if (s0.text.startsWith('@')) {
                return `alias:${s0.text.slice(1)}`;
            }
            return find('css');
        case 'find':
        case 'closest':
        case 'children':
        case 'parent':
        case 'parents':
        case 'siblings':
        case 'next':
        case 'prev':
        case 'nextAll':
        case 'prevAll':
            return args[0] ? find('css') : '';
        case 'contains': {
            if (args.length >= 2) {
                const s1 = evalStr(args[1], ctx);
                return `css:${s0.text} text:${s1.text}`;
            }
            return find('text');
        }
        default: {
            const m = /^find(?:All)?By(Text|Role|TestId|LabelText|PlaceholderText|Title|AltText|DisplayValue)$/.exec(
                name,
            );
            if (!m) {
                return null;
            }
            if (m[1] === 'Role') {
                const opts = args[1] && unwrap(args[1]);
                const nameNode = opts && objectProp(opts, 'name');
                const nm = nameNode ? evalStr(nameNode, ctx) : null;
                return roleLabel(s0.text, nm?.text ?? '');
            }
            const kind = {
                Text: 'text',
                TestId: 'testid',
                LabelText: 'label',
                PlaceholderText: 'placeholder',
                Title: 'title',
                AltText: 'alt',
                DisplayValue: 'value',
            }[m[1]];
            return find(kind);
        }
    }
}

function recordAction(ctx, verb, target, node, text) {
    const entry = {verb, target: target ?? ''};
    if (text) {
        entry.text = text;
    }
    entry.label = [verb, entry.target, text ? `= ${text}` : ''].filter(Boolean).join(' ');
    if (target) {
        ctx.col.locators.add(target);
    }
    push(ctx, ctx.col.actions, entry, node);
}

function recordSetup(ctx, name, node, detail) {
    const entry = {name};
    if (detail?.length) {
        entry.detail = detail;
    }
    push(ctx, ctx.col.setup, entry, node);
}

function recordActor(ctx, key) {
    const k = compactText(key, 40) || '(unknown)';
    if (!ctx.col.actors.has(k)) {
        ctx.col.actors.set(k, 1);
    }
}

function recordAssertion(ctx, entry, node) {
    if (entry.target) {
        ctx.col.locators.add(entry.target);
    }
    push(ctx, ctx.col.assertions, entry, node);
}

function expectedOf(ctx, args, from = 0) {
    const out = [];
    for (let i = from; i < args.length && out.length < 3; i++) {
        const a = unwrap(args[i]);
        if (!a || isFunctionLike(a) || ts.isObjectLiteralExpression(a)) {
            continue;
        }
        const s = evalStr(a, ctx);
        if (s.text !== '' && staticContent(s.text).length > 0) {
            out.push(compactText(s.text, 80));
        }
    }
    return out;
}

function configDetail(ctx, args) {
    const out = [];
    const walk = (node, prefix, depth) => {
        const n = unwrap(node);
        if (!n || !ts.isObjectLiteralExpression(n) || depth > 2) {
            return;
        }
        for (const p of n.properties) {
            if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
                const key = propName(p.name);
                if (!key) {
                    continue;
                }
                const val = ts.isPropertyAssignment(p) ? unwrap(p.initializer) : undefined;
                if (val && ts.isObjectLiteralExpression(val) && depth < 1) {
                    walk(val, `${prefix}${key}.`, depth + 1);
                } else {
                    out.push(`config:${prefix}${key}`);
                }
            }
        }
    };
    for (const a of args) {
        walk(a, '', 0);
    }
    return out;
}

function prefDetail(ctx, args) {
    const out = [];
    const visit = (node) => {
        const n = unwrap(node);
        if (!n) {
            return;
        }
        if (ts.isObjectLiteralExpression(n)) {
            const cat = objectProp(n, 'category');
            const nm = objectProp(n, 'name');
            if (cat && nm) {
                out.push(`pref:${evalStr(cat, ctx).text}.${evalStr(nm, ctx).text}`);
            }
        } else if (ts.isArrayLiteralExpression(n)) {
            n.elements.forEach(visit);
        }
    };
    args.forEach(visit);
    return out;
}

function setupDetail(ctx, name, args) {
    if (/config/i.test(name)) {
        return configDetail(ctx, args);
    }
    if (/preference/i.test(name)) {
        return prefDetail(ctx, args);
    }
    return undefined;
}

function visitArgs(ctx, args) {
    for (const a of args) {
        walkNode(a, ctx);
    }
}

function bindParams(ctx, fn, args, callCtx) {
    const params = new Map();
    const paramNodes = fn.parameters ?? [];
    paramNodes.forEach((p, i) => {
        const arg = args[i];
        let value;
        if (arg) {
            value = evalValue(arg, callCtx, true);
        } else if (p.initializer) {
            value = evalValue(p.initializer, {...callCtx, file: ctx.file, params, locals: ctx.locals}, true);
        } else {
            value = unk(p.name.getText());
        }
        if (ts.isIdentifier(p.name)) {
            params.set(p.name.text, value);
        } else if (ts.isObjectBindingPattern(p.name)) {
            const obj = arg && unwrap(arg);
            for (const el of p.name.elements) {
                if (!ts.isIdentifier(el.name)) {
                    continue;
                }
                const key = el.propertyName ? propName(el.propertyName) : el.name.text;
                const prop = obj && ts.isObjectLiteralExpression(obj) ? objectProp(obj, key) : undefined;
                if (prop) {
                    params.set(el.name.text, evalValue(prop, callCtx, true));
                } else if (el.initializer) {
                    params.set(
                        el.name.text,
                        evalValue(el.initializer, {...callCtx, file: ctx.file, params, locals: ctx.locals}, true),
                    );
                }
            }
        }
    });
    return params;
}

function returnValue(fn, subCtx) {
    let last;
    const visit = (node, top) => {
        if (!top && isFunctionLike(node)) {
            return;
        }
        if (ts.isReturnStatement(node) && node.expression) {
            last = node.expression;
        }
        ts.forEachChild(node, (c) => visit(c, false));
    };
    if (fn.body && !ts.isBlock(fn.body)) {
        last = fn.body;
    } else if (fn.body) {
        visit(fn.body, true);
    }
    return last ? evalValue(last, subCtx, true) : unk();
}

function expandFunction(ctx, params) {
    if (ctx.expanding.has(params.fn)) {
        return unk(params.name);
    }
    ctx.expanding.add(params.fn);
    try {
        return expandFunctionOnce(ctx, params);
    } finally {
        ctx.expanding.delete(params.fn);
    }
}

function expandFunctionOnce(ctx, {fn, file, name, args, callNode, thisVal, label}) {
    const quiet = ctx.depth >= 1 || ctx.silent;
    const sub = {
        ...ctx,
        file,
        locals: collectLocals(fn.body ?? fn, true),
        params: new Map(),
        thisVal: thisVal ?? null,
        depth: ctx.depth + 1,
        via: ctx.via ?? at(ctx, callNode),
        col: quiet ? new Collector() : ctx.col,
        resolving: new Set(),
    };
    sub.params = bindParams(sub, fn, args, ctx);
    if (quiet) {
        if (!ctx.silent) {
            ctx.col.notes.add(`depth_limited:${label ?? name}`);
            const texts = [...args]
                .map((a) => evalStr(a, ctx))
                .filter((x) => !x.dyn)
                .map((x) => compactText(x.text, 30));
            const callLabel = `${label ?? name}(${texts.join(', ')})`;
            push(
                ctx,
                ctx.col.actions,
                {verb: 'call', target: callLabel, label: `call ${callLabel}`, depth_limited: true},
                callNode,
            );
        }
        return returnValue(fn, sub);
    }
    const col = ctx.col;
    const assertions0 = col.assertions.length;
    const setup0 = col.setup.length;
    const argTexts = [...args].map((a) => {
        const s = evalStr(a, ctx);
        return s.dyn ? '' : compactText(s.text, 30);
    });
    const callLabel = `${label ?? name}(${argTexts.filter((t) => t !== '').join(', ')})`;
    const callAt = at(ctx, callNode);
    const slot = col.actions.length;
    col.size += 1;
    col.actions.push({
        verb: 'call',
        target: callLabel,
        label: `call ${callLabel}`,
        seq: col.size,
        at: callAt,
        ...(ctx.via ? {via: ctx.via} : {}),
    });
    const prevLast = col.lastLoc;
    col.lastLoc = null;
    if (fn.body && ts.isBlock(fn.body)) {
        for (const st of fn.body.statements) {
            walkNode(st, sub);
        }
    } else if (fn.body) {
        walkNode(fn.body, sub);
    }
    const lastLoc = col.lastLoc;
    col.lastLoc = prevLast;
    const producedUi = col.actions.length > slot + 1 || col.assertions.length > assertions0;
    if (!producedUi) {
        col.actions.splice(slot, 1);
        if (col.setup.length > setup0) {
            const marker = {name: `helper:${label ?? name}`, seq: col.size, at: callAt};
            if (ctx.via) {
                marker.via = ctx.via;
            }
            col.setup.splice(setup0, 0, marker);
        }
    }
    const ret = returnValue(fn, sub);
    if (ret.t === 'unk' && lastLoc) {
        return {t: 'loc', label: lastLoc};
    }
    return ret;
}

function identValue(name, ctx) {
    const p = ctx.params.get(name);
    if (p) {
        return p;
    }
    if (CLIENT_NAME.test(name)) {
        return {t: 'client', text: name};
    }
    const init = ctx.locals.get(name);
    if (init && ctx.resolving.size < 8 && !ctx.resolving.has(name)) {
        ctx.resolving.add(name);
        try {
            return evalValue(init, ctx, true);
        } finally {
            ctx.resolving.delete(name);
        }
    }
    const cls = ctx.repo.classForVar(name);
    if (cls) {
        return {t: 'po', cls, args: [], key: cls};
    }
    if (/^(page|popup|newPage|[a-z]*Page)$/.test(name)) {
        return {t: 'page', text: name};
    }
    return unk(name);
}

function poInstance(ctx, clsName, args) {
    const vals = [...args].map((a) => evalValue(a, ctx, true));
    const key = `${clsName}|${vals.map((v) => v.label ?? v.text ?? v.t).join('|')}`;
    return {t: 'po', cls: clsName, args: vals, key};
}

function poSubCtx(ctx, po, cls, locals, bindFrom) {
    const params = new Map();
    cls.ctor.params.forEach((p, i) => {
        if (p && po.args[i]) {
            params.set(p, po.args[i]);
        }
    });
    return {
        ...ctx,
        file: cls.file,
        locals: bindFrom ?? locals,
        params,
        thisVal: po,
        resolving: new Set(),
        col: new Collector(),
        silent: true,
        depth: ctx.depth,
    };
}

function poMember(ctx, po, name) {
    const found = ctx.repo.findMember(po.cls, name);
    if (!found) {
        ctx.col.reasons.add(`unresolved_page_object_member:${po.cls}.${name}`);
        return unk(`${po.cls}.${name}`);
    }
    const cacheKey = `${po.key}#${name}`;
    const cache = ctx.repo.poCache;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }
    cache.set(cacheKey, unk(`${po.cls}.${name}`));
    const cls = found.cls;
    const sub = poSubCtx(ctx, po, cls, cls.ctor.locals);
    let value;
    if (found.kind === 'assign') {
        value = evalValue(found.node, sub, true);
    } else if (found.kind === 'field') {
        if (found.field.init) {
            value = evalValue(found.field.init, sub, true);
        } else {
            const tn = found.field.typeNode;
            const tname = tn && ts.isTypeReferenceNode(tn) && ts.isIdentifier(tn.typeName) ? tn.typeName.text : null;
            if (tname === 'Locator') {
                value = {t: 'loc', label: ''};
            } else if (tname && ctx.repo.classes.has(tname)) {
                value = {t: 'po', cls: tname, args: [], key: tname};
            } else {
                value = unk(`${po.cls}.${name}`);
            }
        }
    } else if (found.kind === 'getter') {
        value = returnValue(found.node, sub);
    } else {
        value = unk(`${po.cls}.${name}`);
    }
    cache.set(cacheKey, value);
    return value;
}

function poCall(ctx, po, name, seg) {
    const found = ctx.repo.findMember(po.cls, name);
    if (!found || found.kind !== 'method') {
        if (found) {
            return {value: poMember(ctx, po, name), visited: false};
        }
        ctx.col.reasons.add(`unresolved_page_object_member:${po.cls}.${name}`);
        return {value: unk(`${po.cls}.${name}`), visited: false};
    }
    const value = expandFunction(
        {...ctx, thisVal: po},
        {
            fn: found.node,
            file: found.cls.file,
            name: `${po.cls}.${name}`,
            args: seg.args,
            callNode: seg.node,
            thisVal: po,
            label: `${po.cls}.${name}`,
        },
    );
    return {value, visited: true};
}

function resolveHelper(ctx, name) {
    const local = ctx.file.functions.get(name);
    if (local) {
        return {fn: local, file: ctx.file};
    }
    const imp = ctx.file.imports.get(name);
    if (!imp) {
        return null;
    }
    const exported = imp.imported === 'default' ? name : imp.imported;
    if (imp.spec === '@mattermost/playwright-lib') {
        const lib = ctx.repo.libExports.get(exported);
        return lib ? {fn: lib.node, file: lib.file} : {unresolvable: true};
    }
    if (imp.spec.startsWith('.') || imp.spec.startsWith('@/')) {
        const abs = ctx.repo.resolveModule(ctx.file.rel, imp.spec);
        const target = abs && ctx.repo.file(abs);
        const hit = target && ctx.repo.findFunction(target, exported);
        if (hit) {
            return {fn: hit.fn, file: hit.file};
        }
        return target && ctx.repo.isExternalExport(target, exported) ? {external: true} : {unresolvable: true};
    }
    return {external: true};
}

function callIdentifier(ctx, name, seg) {
    if (GLOBAL_IGNORE.has(name)) {
        return {value: unk(name), visited: false};
    }
    const h = resolveHelper(ctx, name);
    if (h?.fn) {
        const value = expandFunction(ctx, {fn: h.fn, file: h.file, name, args: seg.args, callNode: seg.node});
        return {value, visited: true};
    }
    if (h?.unresolvable) {
        ctx.col.reasons.add(`unresolved_helper:${name}`);
    }
    return {value: unk(name), visited: false};
}

function evalNew(node, ctx) {
    const callee = unwrap(node.expression);
    let name = '';
    if (ts.isIdentifier(callee)) {
        name = callee.text;
    } else if (ts.isPropertyAccessExpression(callee)) {
        name = callee.name.text;
    }
    if (name && ctx.repo.classes.has(name)) {
        return poInstance(ctx, name, node.arguments ?? []);
    }
    return unk(name);
}

export function evalValue(node, ctx, silent = false) {
    const n = unwrap(node);
    if (!n) {
        return unk();
    }
    if (silent && !ctx.silent) {
        const sctx = {...ctx, col: new Collector(), silent: true};
        sctx.col.size = 0;
        return evalValue(n, sctx, true);
    }
    if (
        ts.isStringLiteral(n) ||
        ts.isNoSubstitutionTemplateLiteral(n) ||
        ts.isTemplateExpression(n) ||
        ts.isRegularExpressionLiteral(n) ||
        ts.isNumericLiteral(n)
    ) {
        const s = evalStr(n, ctx);
        return {t: 'str', text: s.text, dyn: s.dyn};
    }
    if (ts.isNewExpression(n)) {
        return evalNew(n, ctx);
    }
    if (ts.isIdentifier(n)) {
        return identValue(n.text, ctx);
    }
    if (n.kind === ts.SyntaxKind.ThisKeyword) {
        return ctx.thisVal ?? unk('this');
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const s = evalStr(n, ctx);
        return {t: 'str', text: s.text, dyn: s.dyn};
    }
    if (ts.isCallExpression(n) || ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
        return evalChain(n, ctx);
    }
    if (ts.isConditionalExpression(n)) {
        return evalValue(n.whenTrue, ctx, true);
    }
    return unk(exprText(n, 24));
}

function identRootValue(rootNode, ctx) {
    if (ts.isIdentifier(rootNode)) {
        return identValue(rootNode.text, ctx);
    }
    if (rootNode.kind === ts.SyntaxKind.ThisKeyword) {
        return ctx.thisVal ?? unk('this');
    }
    if (ts.isNewExpression(rootNode)) {
        return evalNew(rootNode, ctx);
    }
    if (ts.isStringLiteralLike(rootNode) || ts.isTemplateExpression(rootNode)) {
        const s = evalStr(rootNode, ctx);
        return {t: 'str', text: s.text, dyn: s.dyn};
    }
    return unk(exprText(rootNode, 24));
}

function rootName(rootNode) {
    return ts.isIdentifier(rootNode) ? rootNode.text : null;
}

function evalChain(node, ctx) {
    const {root, segs} = flatten(node);
    const name = rootName(root);
    if (name === 'expect' || name === 'assert') {
        return chainExpect(root, segs, ctx, name);
    }
    if (name === 'cy') {
        return chainCy(segs, ctx);
    }
    if (name === 'pw') {
        return chainPw(segs, ctx);
    }
    if (name === 'test' && segs[0]?.name === 'step') {
        return chainTestStep(segs[0], ctx);
    }
    if (name === 'test' || name === 'it' || name === 'describe') {
        visitSegArgs(segs, ctx);
        return unk(name);
    }
    return chainGeneric(root, segs, ctx);
}

function visitSegArgs(segs, ctx) {
    for (const s of segs) {
        if (s.args) {
            visitArgs(ctx, s.args);
        }
    }
}

function chainTestStep(seg, ctx) {
    const fn = [...seg.args].find((a) => isFunctionLike(unwrap(a)));
    if (fn) {
        walkNode(fn, ctx);
    }
    return unk('test.step');
}

function chainPw(segs, ctx) {
    let i = 0;
    let result = unk('pw');
    while (i < segs.length) {
        const s = segs[i];
        if (s.kind === 'prop' && ctx.repo.classForVar(s.name) && s.name !== 'testBrowser') {
            const cls = ctx.repo.classForVar(s.name);
            return runSegs({t: 'po', cls, args: [], key: cls}, segs, i + 1, ctx);
        }
        if (
            s.kind === 'prop' &&
            s.name === 'testBrowser' &&
            segs[i + 1]?.name === 'login' &&
            segs[i + 1].kind === 'call'
        ) {
            const c = segs[i + 1];
            recordActor(ctx, c.args[0] ? exprText(c.args[0], 30) : 'login');
            visitArgs(ctx, c.args);
            result = unk('testBrowser.login');
            i += 2;
            continue;
        }
        if (s.kind === 'prop' && s.name === 'random') {
            i += 2;
            result = unk('random');
            continue;
        }
        if (s.kind === 'call') {
            if (s.name === 'makeClient') {
                recordActor(ctx, s.args[0] ? exprText(s.args[0], 30) : 'makeClient');
                visitArgs(ctx, s.args);
                result = {t: 'client', text: 'makeClient'};
            } else if (PW_IGNORED.has(s.name) || s.name.startsWith('skip')) {
                visitArgs(ctx, s.args);
                result = unk(`pw.${s.name}`);
            } else {
                recordSetup(ctx, `pw:${s.name}`, s.node, setupDetail(ctx, s.name, s.args) ?? featureDetail(ctx, s));
                visitArgs(ctx, s.args);
                result = unk(`pw.${s.name}`);
            }
        }
        i += 1;
    }
    return result;
}

function featureDetail(ctx, seg) {
    if (seg.name !== 'ensureFeatureFlag') {
        return undefined;
    }
    const a = seg.args[0] && unwrap(seg.args[0]);
    if (a && ts.isObjectLiteralExpression(a)) {
        return a.properties.map((p) => `flag:${propName(p.name)}`);
    }
    return a ? [`flag:${evalStr(a, ctx).text}`] : undefined;
}

function chainExpect(root, segs, ctx, rootName) {
    let i = 0;
    const first = segs[0];
    if (!first) {
        return unk(rootName);
    }
    let targetArgNode;
    let soft = false;
    if (first.kind === 'rootcall') {
        targetArgNode = first.args[0];
        i = 1;
    } else if (first.kind === 'call' && ['soft', 'poll', 'configure'].includes(first.name) && rootName === 'expect') {
        targetArgNode = first.args[0];
        soft = first.name === 'soft';
        i = 1;
    } else if (rootName === 'assert') {
        return chainAssertLib(segs, ctx);
    } else {
        visitSegArgs(segs, ctx);
        return unk(rootName);
    }
    let target = '';
    if (targetArgNode) {
        const targetNode = unwrap(targetArgNode);
        if (isFunctionLike(targetNode)) {
            target = exprText(targetNode.body, 60);
            walkNode(targetNode, ctx);
        } else {
            const v = evalValue(targetArgNode, ctx);
            if (v.t === 'loc') {
                target = v.label;
            } else if (v.t === 'str') {
                target = `value:${compactText(v.text, 40)}`;
            } else {
                target = exprText(targetArgNode, 60);
            }
        }
    }
    let negated = false;
    const names = [];
    let lastCall;
    for (; i < segs.length; i++) {
        const s = segs[i];
        if (s.name === 'not') {
            negated = !negated;
        }
        names.push(s.name);
        if (s.kind === 'call') {
            lastCall = s;
        }
    }
    if (names.length) {
        const matcher = names.filter((n) => n !== 'not').join('.');
        const entry = {
            kind: 'expect',
            matcher,
            target,
            negated,
            expected: lastCall ? expectedOf(ctx, lastCall.args) : [],
        };
        if (soft) {
            entry.soft = true;
        }
        recordAssertion(ctx, entry, root.parent ?? root);
        if (lastCall) {
            visitArgs(ctx, lastCall.args);
        }
    }
    return unk('expect');
}

function chainAssertLib(segs, ctx) {
    const s = segs[0];
    const args = s.args ?? [];
    const target = args[0] ? exprText(args[0], 60) : '';
    recordAssertion(
        ctx,
        {
            kind: 'assert',
            matcher: `assert.${s.name}`,
            target,
            negated: /not/i.test(s.name),
            expected: expectedOf(ctx, args, 1),
        },
        s.node,
    );
    visitArgs(ctx, args);
    return unk('assert');
}

function chainGeneric(root, segs, ctx) {
    const rootNode = root;
    let val;
    let i = 0;
    const first = segs[0];
    if (ts.isIdentifier(rootNode) && first?.kind === 'rootcall') {
        const r = callIdentifier(ctx, rootNode.text, first);
        val = r.value;
        if (!r.visited) {
            visitArgs(ctx, first.args);
        }
        i = 1;
    } else {
        if (
            !ts.isIdentifier(rootNode) &&
            rootNode.kind !== ts.SyntaxKind.ThisKeyword &&
            !ts.isNewExpression(rootNode) &&
            !ts.isStringLiteralLike(rootNode)
        ) {
            walkChildrenOfRoot(rootNode, ctx);
        }
        val = identRootValue(rootNode, ctx);
        if (ts.isNewExpression(rootNode)) {
            visitArgs(ctx, rootNode.arguments ?? []);
        }
    }
    return runSegs(val, segs, i, ctx);
}

function runSegs(startVal, segs, from, ctx) {
    let val = startVal;
    let lastLocatorSeg = false;
    for (let i = from; i < segs.length; i++) {
        const s = segs[i];
        if (s.kind === 'prop') {
            val = memberOf(val, s.name, ctx);
            lastLocatorSeg = false;
            continue;
        }
        if (s.kind === 'rootcall') {
            visitArgs(ctx, s.args);
            val = unk();
            continue;
        }
        const r = methodCall(val, s, ctx);
        val = r.value;
        lastLocatorSeg = r.locator;
        if (!r.visited) {
            visitArgs(ctx, s.args);
        }
    }
    if (val.t === 'loc' && lastLocatorSeg && val.label) {
        ctx.col.locators.add(val.label);
    }
    return val;
}

function walkChildrenOfRoot(rootNode, ctx) {
    ts.forEachChild(rootNode, (c) => walkNode(c, ctx));
}

function memberOf(val, name, ctx) {
    if (val.t === 'po') {
        return poMember(ctx, val, name);
    }
    if (val.t === 'page' && (name === 'keyboard' || name === 'mouse')) {
        return {t: 'kbd', text: name};
    }
    if (val.t === 'client') {
        return val;
    }
    const cls = ctx.repo.classForVar(name);
    if (cls && (val.t === 'unk' || val.t === 'page')) {
        return {t: 'po', cls, args: [], key: cls};
    }
    return unk(`${val.text ?? ''}.${name}`);
}

function methodCall(val, seg, ctx) {
    const {name, args, node} = seg;
    if (PW_LOCATOR_METHODS.has(name)) {
        const part = pwLocatorPart(ctx, name, args);
        const base = val.t === 'loc' ? val.label : '';
        return {
            value: {t: 'loc', label: part ? compose(base, part) : base},
            locator: true,
            visited: true,
            ...visitedLocatorArgs(ctx, args),
        };
    }
    if (val.t === 'po') {
        const r = poCall(ctx, val, name, seg);
        if (r.value.t === 'loc') {
            return {value: r.value, locator: true, visited: r.visited};
        }
        return {value: r.value, locator: false, visited: r.visited};
    }
    if (PW_ACTIONS.has(name) && (val.t === 'loc' || val.t === 'unk')) {
        const text = ['fill', 'type', 'press', 'pressSequentially', 'selectOption'].includes(name)
            ? firstStatic(ctx, args)
            : '';
        recordAction(ctx, name, val.t === 'loc' ? val.label : '', node, text);
        return {value: unk(), locator: false, visited: false};
    }
    if (val.t === 'kbd') {
        recordAction(ctx, `${val.text}.${name}`, '', node, firstStatic(ctx, args));
        return {value: unk(), locator: false, visited: false};
    }
    if (PW_NAV.has(name) && val.t !== 'client') {
        recordAction(ctx, name, '', node, args[0] ? firstStatic(ctx, args) : '');
        return {value: unk(), locator: false, visited: false};
    }
    if (val.t === 'client') {
        recordSetup(ctx, `api:${name}`, node, setupDetail(ctx, name, args));
        return {value: unk(), locator: false, visited: false};
    }
    if (name === 'newPage' || name === 'newContext') {
        recordActor(ctx, `${name}:${lineOf(ctx.file.sf, node)}`);
        return {value: {t: 'page', text: name}, locator: false, visited: false};
    }
    if (name === 'route' || name === 'routeWebSocket') {
        recordSetup(ctx, `route:${args[0] ? firstStatic(ctx, args) : ''}`, node);
        return {value: unk(), locator: false, visited: false};
    }
    return {value: unk(`${val.text ?? ''}.${name}()`), locator: false, visited: false};
}

function visitedLocatorArgs(ctx, args) {
    for (const a of args) {
        const n = unwrap(a);
        if (n && isFunctionLike(n)) {
            walkNode(n, ctx);
        }
    }
    return {};
}

function firstStatic(ctx, args) {
    const a = args[0];
    if (!a) {
        return '';
    }
    const n = unwrap(a);
    if (ts.isArrayLiteralExpression(n) || ts.isObjectLiteralExpression(n) || isFunctionLike(n)) {
        return '';
    }
    const s = evalStr(a, ctx);
    return compactText(s.text, 50);
}

function chainCy(segs, ctx) {
    let subject = null;
    let locatorEnded = false;
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (s.kind !== 'call') {
            continue;
        }
        const {name, args, node} = s;
        locatorEnded = false;
        const label = cyLocatorLabel(ctx, name, args);
        if (label !== null) {
            if (name === 'get' || name === 'contains' || /^find(All)?By/.test(name)) {
                subject = name === 'get' || i === 0 ? label : compose(subject, label);
            } else if (label) {
                subject = compose(subject, label);
            }
            locatorEnded = Boolean(subject);
            if (name === 'contains' || name.startsWith('find')) {
                visitArgs(ctx, args);
            }
            continue;
        }
        if (CY_ACTIONS.has(name)) {
            const text = ['type', 'select', 'press', 'trigger', 'realType', 'realPress'].includes(name)
                ? firstStatic(ctx, args)
                : '';
            recordAction(ctx, name, subject ?? '', node, text);
            visitArgs(ctx, args);
            continue;
        }
        switch (name) {
            case 'visit':
            case 'go':
            case 'reload':
                recordAction(ctx, name, '', node, args[0] ? firstStatic(ctx, args) : '');
                visitArgs(ctx, args);
                subject = null;
                break;
            case 'url':
            case 'title':
            case 'hash':
            case 'window':
            case 'document':
            case 'focused':
                subject = name;
                break;
            case 'location':
                subject = args[0] ? `location:${firstStatic(ctx, args)}` : 'location';
                break;
            case 'wrap':
                subject = `wrap:${args[0] ? exprText(args[0], 30) : ''}`;
                visitArgs(ctx, args);
                break;
            case 'invoke':
            case 'its':
                subject = `${subject ?? ''} ${name}:${firstStatic(ctx, args)}`.trim();
                visitArgs(ctx, args.slice(1));
                break;
            case 'should':
            case 'and':
                cyShould(ctx, subject, s);
                break;
            case 'task':
                recordSetup(ctx, `task:${firstStatic(ctx, args)}`, node);
                visitArgs(ctx, args);
                break;
            case 'exec':
            case 'request':
            case 'intercept':
            case 'route':
            case 'server':
                recordSetup(ctx, `cy:${name}`, node, undefined);
                visitArgs(ctx, args);
                break;
            case 'within':
            case 'then':
            case 'each':
            case 'spread':
            case 'tap':
            case 'waitUntil':
                visitArgs(ctx, args);
                if (name === 'then') {
                    subject = null;
                }
                break;
            case 'postMessageAs': {
                const o = args[0] && unwrap(args[0]);
                const sender = o && objectProp(o, 'sender');
                recordActor(ctx, sender ? exprText(sender, 30) : 'postMessageAs');
                recordSetup(ctx, 'cy:postMessageAs', node);
                visitArgs(ctx, args);
                break;
            }
            default: {
                if (CY_PASSTHROUGH_NAMES.has(name)) {
                    visitArgs(ctx, args);
                    break;
                }
                if (CY_ACTOR_CMDS.has(name)) {
                    recordActor(ctx, actorKey(name, args));
                }
                if (name === 'apiInitSetup' && args[0] && objectProp(unwrap(args[0]), 'loginAfter')) {
                    recordActor(ctx, 'initSetup-user');
                }
                if (CY_SETUP_PREFIX.test(name)) {
                    recordSetup(ctx, `cy:${name}`, node, setupDetail(ctx, name, args));
                    visitArgs(ctx, args);
                    break;
                }
                const cmd = ctx.repo.cypressCommands.get(name);
                if (!cmd) {
                    ctx.col.reasons.add(`unresolved_cy_command:${name}`);
                    visitArgs(ctx, args);
                    break;
                }
                const value = expandFunction(ctx, {
                    fn: cmd.node,
                    file: cmd.file,
                    name,
                    args,
                    callNode: node,
                    label: name,
                });
                subject = value.t === 'loc' && value.label ? value.label : null;
                visitArgs(ctx, args);
                break;
            }
        }
    }
    if (subject) {
        ctx.col.lastLoc = subject;
        if (locatorEnded) {
            ctx.col.locators.add(subject);
        }
    }
    return subject ? {t: 'loc', label: subject} : unk('cy');
}

function cyShould(ctx, subject, seg) {
    const {args, node} = seg;
    const first = args[0] && unwrap(args[0]);
    if (!first) {
        return;
    }
    if (isFunctionLike(first)) {
        const hasExpect = first.getText().match(/\b(expect|assert)\b/);
        if (!hasExpect) {
            recordAssertion(
                ctx,
                {kind: 'should', matcher: 'callback', target: subject ?? '', negated: false, expected: []},
                node,
            );
        }
        walkNode(first, ctx);
        return;
    }
    const m = ts.isIdentifier(first) ? {text: first.text, dyn: false} : evalStr(first, ctx);
    recordAssertion(
        ctx,
        {
            kind: 'should',
            matcher: m.text,
            target: subject ?? '',
            negated: /(^|\.)not\./.test(m.text) || m.text.startsWith('not'),
            expected: expectedOf(ctx, args, 1),
        },
        node,
    );
    visitArgs(ctx, [...args].slice(1));
}

export function walkNode(node, ctx) {
    if (!node || ctx.col.full) {
        return;
    }
    if (
        ts.isCallExpression(node) ||
        ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
            flatten(node).root &&
            rootName(flatten(node).root) === 'expect')
    ) {
        evalChain(node, ctx);
        return;
    }
    if (ts.isNewExpression(node)) {
        visitArgs(ctx, node.arguments ?? []);
        return;
    }
    if (
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isInterfaceDeclaration(node)
    ) {
        return;
    }
    ts.forEachChild(node, (c) => walkNode(c, ctx));
}

export function newCtx({repo, file, locals, via = null}) {
    return {
        repo,
        file,
        locals,
        params: new Map(),
        thisVal: null,
        depth: 0,
        via,
        col: new Collector(),
        resolving: new Set(),
        silent: false,
        expanding: new Set(),
    };
}
