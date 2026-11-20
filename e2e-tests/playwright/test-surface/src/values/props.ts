// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {carryArms, lit, prefixCompatible, truncated, withFrom} from './algebra.ts';
import type {KeyClassifier} from './keys.ts';
import {attrValueOf, classOfThis, isHocCall, symbolOf} from './type_utils.ts';
import type {Env, PropAt, PropsRef, Source, Value} from './types.ts';

import {isFunctionLike, propName, returnsOf, strip, type FunctionLike} from '../ast.ts';
import {MAX_OBJECT_KEYS_DEPTH, MAX_RESOLVE_DEPTH, MAX_USAGE_VALUES} from '../limits.ts';
import {usageAttrs, usageNode, type CodeNode, type Loc, type ProgramIndex, type Usage} from '../program_index.ts';
import {typescript} from '../typescript.ts';

/** Expression operations used while following props through their mount sites. */
interface PropExpressions {
    sources(e: ts.Expression | Source, depth?: number, seen?: Set<ts.Node>, via?: Loc[]): Source[];
    literalOf(v: ts.Expression | undefined): ts.Expression | undefined;
    literalsOf(v: ts.Expression, depth?: number): ts.Expression[];
    memberOfLiteral(v: ts.Expression | undefined, k: string): ts.Expression | undefined;
    resolve(e: ts.Expression | undefined, depth?: number, seen?: Set<ts.Node>, env?: Env | null): Value[];
    unres(why: string, n?: ts.Node): Value;
    descend(expr: ts.Expression | undefined, rest: string[], depth: number, seen: Set<ts.Node>): Value[];
}

/** Trace prop paths, defaults and spreads through each concrete component mount. */
export class PropTracer {
    private readonly ix: ProgramIndex;
    private readonly checker: ts.TypeChecker;
    private readonly keys: KeyClassifier;
    private readonly expressions: PropExpressions;
    constructor(ix: ProgramIndex, keys: KeyClassifier, expressions: PropExpressions) {
        this.ix = ix;
        this.checker = ix.checker;
        this.keys = keys;
        this.expressions = expressions;
    }

    // ---- components and props paths ----------------------------------------------------

    /** The component that owns a node: the nearest class, or function that isn't an inline callback. */
    componentOf(node: ts.Node): CodeNode | null {
        for (let n = node.parent; n; n = n.parent) {
            if (typescript.isClassDeclaration(n) || typescript.isClassExpression(n)) {
                return n;
            }
            if (isFunctionLike(n) && !typescript.isMethodDeclaration(n)) {
                if (n.parent && typescript.isCallExpression(n.parent) && n.parent.arguments.includes(n as ts.Expression) && !isHocCall(n.parent)) {
                    continue;
                }
                if (n.parent && typescript.isJsxExpression(n.parent)) {
                    continue;
                }
                return n;
            }
        }
        return null;
    }

    /** The props path an expression reads: props.a.b, this.props.a, or identifiers bound from props. */
    propsPath(e: ts.Node): PropsRef | null {
        const x = strip(e as ts.Expression) as ts.Expression;
        const chain: string[] = [];
        let cur: ts.Expression = x;
        while (typescript.isPropertyAccessExpression(cur) || (typescript.isElementAccessExpression(cur) && typescript.isStringLiteralLike(cur.argumentExpression))) {
            chain.unshift(typescript.isPropertyAccessExpression(cur) ? cur.name.text : (cur.argumentExpression as ts.StringLiteralLike).text);
            cur = strip(cur.expression) as ts.Expression;
        }
        if (chain.length && chain[0] === 'props' && cur.kind === typescript.SyntaxKind.ThisKeyword) {
            return {path: chain.slice(1), comp: classOfThis(x)};
        }
        if (!typescript.isIdentifier(cur)) {
            return null;
        }
        const d = symbolOf(this.checker, cur)?.valueDeclaration;
        if (!d) {
            return null;
        }
        if (typescript.isParameter(d)) {
            const fn = d.parent as FunctionLike;
            if (fn.parameters?.[0] !== d) {
                return null;
            }
            return this.isComponentFn(fn) ? {path: chain, comp: fn} : null;
        }
        if (typescript.isBindingElement(d) && d.dotDotDotToken) {
            const rp = this.restPropsOf(cur);
            return rp ? {path: [...rp.path, ...chain], comp: rp.comp} : null;
        }
        if (typescript.isBindingElement(d)) {
            const bp = this.bindingPath(d);
            if (!bp) {
                return null;
            }
            if (bp.root.kind === 'param') {
                return this.isComponentFn(bp.root.fn) ? {path: [...bp.path, ...chain], comp: bp.root.fn} : null;
            }
            const inner = this.propsPath(bp.root.expr);
            if (inner) {
                return {path: [...inner.path, ...bp.path, ...chain], comp: inner.comp};
            }
            const re = strip(bp.root.expr) as ts.Expression;
            if (typescript.isPropertyAccessExpression(re) && re.name.text === 'props' && re.expression.kind === typescript.SyntaxKind.ThisKeyword) {
                return {path: [...bp.path, ...chain], comp: classOfThis(re)};
            }
        }
        return null;
    }

    /**
     * The props paths an expression is built from: read directly, or inside a template, a call's arguments
     * (`withRole(props.menuButton.testId, 'button')`), a ternary or a fallback, and through the local values the
     * resolver follows (`const id = …`, `useMemo`). Not into inline functions, and not on to the usages that pass
     * the props.
     */
    propsReads(e: ts.Expression, depth = 0, seen = new Set<ts.Node>()): PropsRef[] {
        const out: PropsRef[] = [];
        const visit = (n: ts.Node): void => {
            if (isFunctionLike(n)) {
                return;
            }
            const pp = typescript.isExpression(n) ? this.propsPath(n) : null;
            if (pp) {
                out.push(pp);
                return;
            }
            if (typescript.isIdentifier(n) && depth < MAX_RESOLVE_DEPTH && !seen.has(n)) {
                seen.add(n);
                for (const s of this.expressions.sources(n)) {
                    if (!('marker' in s) && s.expr !== n && !seen.has(s.expr)) {
                        out.push(...this.propsReads(s.expr, depth + 1, seen));
                    }
                }
                return;
            }
            typescript.forEachChild(n, visit);
        };
        visit(e);
        return out;
    }

    /** `...rest` destructured from props: a pass-through of the same props. */
    restPropsOf(e: ts.Expression): PropsRef | null {
        if (!typescript.isIdentifier(e)) {
            return null;
        }
        const d = symbolOf(this.checker, e)?.valueDeclaration;
        if (!d || !typescript.isBindingElement(d) || !d.dotDotDotToken) {
            return null;
        }
        const holder = d.parent.parent;
        if (typescript.isParameter(holder) && this.isComponentFn(holder.parent as FunctionLike)) {
            return {path: [], comp: holder.parent as FunctionLike};
        }
        if (typescript.isBindingElement(holder)) {
            const bp = this.bindingPath(holder);
            if (bp && bp.root.kind === 'param' && this.isComponentFn(bp.root.fn)) {
                return {path: bp.path, comp: bp.root.fn};
            }
        }
        if (typescript.isVariableDeclaration(holder) && holder.initializer) {
            const pp = this.propsPath(holder.initializer);
            if (pp) {
                return pp;
            }
            const re = strip(holder.initializer) as ts.Expression;
            if (typescript.isPropertyAccessExpression(re) && re.name.text === 'props' && re.expression.kind === typescript.SyntaxKind.ThisKeyword) {
                return {path: [], comp: classOfThis(re)};
            }
        }
        return null;
    }

    /** Recover a destructured binding’s field path and its parameter or initializer root. */
    bindingPath(be: ts.BindingElement): {path: string[]; root: {kind: 'param'; fn: FunctionLike} | {kind: 'expr'; expr: ts.Expression}} | null {
        const p: string[] = [];
        let n: ts.Node = be;
        while (typescript.isBindingElement(n)) {
            if (n.dotDotDotToken) {
                return null;
            }
            const key = n.propertyName ? propName(n.propertyName) : propName(n.name);
            if (key === null) {
                return null;
            }
            p.unshift(key);
            n = n.parent.parent;
        }
        if (typescript.isParameter(n)) {
            return {path: p, root: {kind: 'param', fn: n.parent as FunctionLike}};
        }
        if (typescript.isVariableDeclaration(n) && n.initializer) {
            return {path: p, root: {kind: 'expr', expr: n.initializer}};
        }
        return null;
    }

    /** Distinguish indexed components and JSX functions from ordinary local helpers. */
    isComponentFn(fn: FunctionLike | undefined): boolean {
        if (!fn) {
            return false;
        }
        if (this.ix.usages.has(fn) || this.ix.dialogRefs.has(fn)) {
            return true;
        }
        let name = fn.name?.getText();
        if (!name && fn.parent && typescript.isVariableDeclaration(fn.parent)) {
            name = fn.parent.name.getText();
        }
        if (!name && fn.parent && typescript.isCallExpression(fn.parent)) {
            const vd = fn.parent.parent;
            if (vd && typescript.isVariableDeclaration(vd)) {
                name = vd.name.getText();
            }
        }
        return Boolean(name) && (/^[A-Z]/).test(name!);
    }

    private readonly defaultMemo = new Map<CodeNode, Map<string, ts.Expression>>();

    /** A component's default for a prop: `({key = 'x'})`, `const {key = 'x'} = props`, or `static defaultProps = {key: 'x'}`. */
    private defaultFor(comp: CodeNode, key: string): ts.Expression | null {
        let defaults = this.defaultMemo.get(comp);
        if (!defaults) {
            defaults = new Map();
            this.defaultMemo.set(comp, defaults);
            const fromPattern = (pat: ts.ObjectBindingPattern) => {
                for (const el of pat.elements) {
                    const k = el.propertyName ? propName(el.propertyName) : propName(el.name);
                    if (k && el.initializer && !defaults!.has(k)) {
                        defaults!.set(k, el.initializer);
                    }
                }
            };
            const p = (comp as FunctionLike).parameters?.[0];
            if (p && typescript.isObjectBindingPattern(p.name)) {
                fromPattern(p.name);
            }
            const visit = (n: ts.Node) => {
                if (typescript.isVariableDeclaration(n) && typescript.isObjectBindingPattern(n.name) && n.initializer) {
                    const init = strip(n.initializer) as ts.Expression;
                    const pp = this.propsPath(init);
                    const isThisProps = typescript.isPropertyAccessExpression(init) && init.name.text === 'props' && init.expression.kind === typescript.SyntaxKind.ThisKeyword;
                    if ((pp && pp.comp === comp && !pp.path.length) || isThisProps) {
                        fromPattern(n.name);
                    }
                }
                if (typescript.isPropertyDeclaration(n) && propName(n.name) === 'defaultProps' && n.initializer && typescript.isObjectLiteralExpression(n.initializer)) {
                    for (const q of n.initializer.properties) {
                        const k = propName(q.name);
                        if (k && typescript.isPropertyAssignment(q) && !defaults!.has(k)) {
                            defaults!.set(k, q.initializer);
                        }
                    }
                }
                if (n === comp || (!isFunctionLike(n) && !typescript.isClassLike(n)) || typescript.isMethodDeclaration(n) || (typescript.isArrowFunction(n) && typescript.isClassLike(comp))) {
                    typescript.forEachChild(n, visit);
                }
            };
            visit(comp);
        }
        return defaults.get(key) ?? null;
    }

    /** Where `propPath` comes from at one usage: the last matching attribute or spread wins, as in JSX. */
    propAt(comp: CodeNode, u: Usage, propPath: string[], seen: Set<ts.Node>): PropAt {
        const attrs = usageAttrs(u);
        for (let i = attrs.length - 1; i >= 0; i--) {
            const a = attrs[i];
            if ('name' in a) {
                if (a.name !== propPath[0]) {
                    continue;
                }
                return a.value ? {kind: 'value', expr: a.value, rest: propPath.slice(1)} : {kind: 'true'};
            }
            const r = this.throughSpread(a.spread, propPath, seen, comp);
            if (r) {
                return r;
            }
        }
        const dflt = propPath.length === 1 ? this.defaultFor(comp, propPath[0]) : null;
        if (dflt) {
            return {kind: 'default', expr: dflt};
        }

        // connect(mapStateToProps) can supply it: runtime data, not a missing value (unless its maps visibly don't)
        return this.ix.connects.has(comp) && this.connectMaySupply(comp, propPath[0]) ? {kind: 'connect'} : {kind: 'absent'};
    }

    /** Whether `connect(mapState, mapDispatch)` can supply a prop: false only when both maps' returned keys are known and lack it. */
    private connectMaySupply(comp: CodeNode, prop: string): boolean {
        const call = this.ix.connectCalls.get(comp);
        if (!call) {
            return true;
        }
        const merge = call.arguments[2] && strip(call.arguments[2]);
        if (merge && merge.kind !== typescript.SyntaxKind.NullKeyword && !(typescript.isIdentifier(merge) && merge.text === 'undefined')) {
            return true;
        }
        for (const arg of call.arguments.slice(0, 2)) {
            const keys = this.objectKeys(arg, 0, new Set());
            if (!keys || keys.has(prop)) {
                return true;
            }
        }
        return false;
    }

    /** Keys of the object a map function (or object, or factory) produces; null when not statically known. */
    private objectKeys(e: ts.Node | undefined, depth: number, seen: Set<ts.Node>): Set<string> | null {
        const x = strip(e as ts.Expression) as ts.Expression | undefined;
        if (!x || x.kind === typescript.SyntaxKind.NullKeyword || (typescript.isIdentifier(x) && x.text === 'undefined')) {
            return new Set();
        }
        if (depth > MAX_OBJECT_KEYS_DEPTH || seen.has(x)) {
            return null;
        }
        seen.add(x);
        if (typescript.isObjectLiteralExpression(x)) {
            const keys = new Set<string>();
            for (const p of x.properties) {
                const name = typescript.isSpreadAssignment(p) ? null : propName(p.name);
                if (!name) {
                    return null;
                }
                keys.add(name);
            }
            return keys;
        }
        if (isFunctionLike(x)) {
            const out = new Set<string>();
            for (const r of returnsOf(x)) {
                const ks = this.objectKeys(r, depth + 1, seen);
                if (!ks) {
                    return null;
                }
                ks.forEach((k) => out.add(k));
            }
            return out;
        }
        if (typescript.isIdentifier(x) || typescript.isCallExpression(x)) {
            const target = typescript.isIdentifier(x) ? x : x.expression;
            const sym = this.ix.checker.getSymbolAtLocation(target);
            const node = this.ix.resolveSymbolToNode(sym);
            const d = sym?.valueDeclaration;
            const def = node ?? (d && typescript.isVariableDeclaration(d) ? d.initializer : undefined);
            if (!def || this.ix.isLibraryNode(def)) {
                return null;
            }

            // a factory (`makeMapStateToProps()`) returns the map function
            if (typescript.isCallExpression(x) && isFunctionLike(def)) {
                const out = new Set<string>();
                for (const r of returnsOf(def)) {
                    const ks = this.objectKeys(r, depth + 1, seen);
                    if (!ks) {
                        return null;
                    }
                    ks.forEach((k) => out.add(k));
                }
                return out;
            }
            return this.objectKeys(def, depth + 1, seen);
        }
        return null;
    }

    /** `{...props}` / `{...rest}` / `{...{a: 1}}` / `{...local}`. Null if the spread can't carry the prop. */
    private throughSpread(spread: ts.Expression, propPath: string[], seen: Set<ts.Node>, comp?: CodeNode): PropAt | null {
        // `{...rest}` after `area={area}` doesn't override it when rest's type has no `area`: the rest of the props after
        // destructuring is typed exactly (JSX takes the last attribute or spread that carries the prop). A props object
        // passed in whole (`{...data}` from a library) may carry more than its type says.
        const obj0 = strip(spread) as ts.Expression;
        if (this.restPropsOf(obj0) && !this.mayCarry(spread, propPath[0], comp)) {
            return null;
        }
        const pp = this.propsPath(spread);

        // so is a field of the props of a component this repo renders (`{...actionProps}` after `testIdScope={…}`): its own
        // props type declares it, so one without the prop (or whose index can't hold its value) leaves the earlier
        // attribute in force. A component only a library renders (a react-select Option's `{...data}`) is not typed exactly.
        if (pp && pp.comp && pp.path.length && (this.ix.usages.get(pp.comp) ?? []).length && !this.mayCarry(spread, propPath[0], comp)) {
            return null;
        }
        if (pp && pp.comp && !seen.has(pp.comp)) {
            return {kind: 'up', comp: pp.comp, path: [...pp.path, ...propPath]};
        }
        const obj = strip(spread) as ts.Expression;
        const carries = (o: ts.ObjectLiteralExpression) => o.properties.some((q) => typescript.isSpreadAssignment(q) || propName(q.name) === propPath[0]);
        if (typescript.isObjectLiteralExpression(obj)) {
            return carries(obj) ? {kind: 'object', expr: obj, path: propPath} : null;
        }
        const rp = this.restPropsOf(obj);
        if (rp && rp.comp && !seen.has(rp.comp)) {
            return {kind: 'up', comp: rp.comp, path: [...rp.path, ...propPath]};
        }
        if (typescript.isIdentifier(obj)) {
            const dd = symbolOf(this.checker, obj)?.valueDeclaration;
            if (dd && typescript.isVariableDeclaration(dd) && dd.initializer) {
                const init = strip(dd.initializer) as ts.Expression;
                if (typescript.isObjectLiteralExpression(init) && !carries(init)) {
                    return null;
                }
                return {kind: 'object', expr: dd.initializer, path: propPath};
            }

            // a local helper's parameter (`renderRoutes(extraProps)`): the objects its calls pass (propSources follows them)
            if (dd && typescript.isParameter(dd) && (this.ix.calls.get(dd.parent as FunctionLike) ?? []).length) {
                return {kind: 'object', expr: obj, path: propPath};
            }
        }

        // a spread of a typed object that has no such property can't carry it
        if (!this.mayCarry(spread, propPath[0], comp)) {
            return null;
        }
        return {kind: 'unknown', node: spread};
    }

    /**
     * Whether a spread can carry a prop: unless its type is a known object type with no such property (and no string
     * index), any member of a union having it, it may. A hyphenated prop (`data-testid`, `aria-label`) always may: JSX
     * passes those to any component without its props type declaring them.
     */
    mayCarry(spread: ts.Expression, prop: string, comp?: CodeNode): boolean {
        if (prop.includes('-')) {
            return true;
        }
        const t = this.checker.getTypeAtLocation(spread);

        // `{...(cond && {x})}`: a falsy member spreads nothing
        const nothing = typescript.TypeFlags.Undefined | typescript.TypeFlags.Null | typescript.TypeFlags.BooleanLike | typescript.TypeFlags.Void | typescript.TypeFlags.Never;
        const members = (t.isUnion() ? t.types : [t]).filter((m) => !(m.flags & nothing));
        const known = (m: ts.Type) => Boolean(m.flags & typescript.TypeFlags.Object) || m.isIntersection();
        if (!members.every(known)) {
            return true;
        }
        return members.some((m) => m.getProperty(prop) || this.indexMayCarry(spread, m, prop, comp));
    }

    /**
     * Whether a spread's string index (`{...actionUserProps}` of `{[userId: string]: {teamMember: …}}`) can supply a prop:
     * only with a value the prop accepts, by the props type of the component it reaches (a dynamic `<Action/>` tag is
     * typed `ComponentType<any>`, its component `TeamMembersDropdown` is not), else of the tag. Unknown when neither says.
     */
    private indexMayCarry(spread: ts.Expression, type: ts.Type, prop: string, comp?: CodeNode): boolean {
        const index = this.checker.getIndexInfoOfType(type, typescript.IndexKind.String);
        if (!index) {
            return false;
        }
        const attributes = spread.parent && typescript.isJsxSpreadAttribute(spread.parent) ? spread.parent.parent : undefined;
        const accepted = (comp && this.acceptedPropType(comp, prop)) ?? (attributes && this.checker.getContextualType(attributes)?.getProperty(prop) && this.checker.getTypeOfSymbolAtLocation(this.checker.getContextualType(attributes)!.getProperty(prop)!, attributes));
        if (!accepted || accepted.flags & (typescript.TypeFlags.Any | typescript.TypeFlags.Unknown)) {
            return true;
        }
        return this.checker.isTypeAssignableTo(index.type, accepted);
    }

    /** The type a component declares for one of its props: a function's first parameter, a class's `props`. */
    private acceptedPropType(comp: CodeNode, prop: string): ts.Type | undefined {
        let props: ts.Type | undefined;
        if (isFunctionLike(comp) && comp.parameters[0]) {
            props = this.checker.getTypeAtLocation(comp.parameters[0]);
        } else if (typescript.isClassLike(comp)) {
            const instance = this.checker.getTypeAtLocation(comp);
            const member = instance.getProperty('props');
            props = member && this.checker.getTypeOfSymbolAtLocation(member, comp);
        }
        const symbol = props?.getProperty(prop);
        return symbol && this.checker.getTypeOfSymbolAtLocation(symbol, comp);
    }

    /** The `dialogProps` expression of a modal reference. */
    dialogPropsOf(ref: {kind: 'object'; node: ts.ObjectLiteralExpression} | {kind: 'jsx'; node: ts.JsxOpeningElement | ts.JsxSelfClosingElement}): ts.Expression | undefined {
        if (ref.kind === 'object') {
            const p = ref.node.properties.find((q) => propName(q.name) === 'dialogProps');
            return p && typescript.isPropertyAssignment(p) ? p.initializer : undefined;
        }
        return attrValueOf(ref.node, 'dialogProps');
    }

    /** Source expressions of a props path across every usage (and modal reference) of a component. */
    propSources(comp: CodeNode, propPath: string[], depth: number, seen: Set<ts.Node>, via: Loc[], read?: ts.Expression): Source[] {
        const out: Source[] = [];
        for (const u of this.ix.usages.get(comp) ?? []) {
            const at = [...via, this.ix.where(usageNode(u))];
            const r = this.propAt(comp, u, propPath, seen);
            if (r.kind === 'value' || r.kind === 'object') {
                const rest = r.kind === 'value' ? r.rest : r.path;

                // `actions={actions}` with `.editName` still to pick: the value is the parent's own prop, so the
                // member comes from the parent's usages (an actions object passed down through several components)
                const up = rest.length ? this.propsPath(r.expr) : null;
                if (up && up.comp && up.path.length && !seen.has(up.comp)) {
                    out.push(...this.propSources(up.comp, [...up.path, ...rest], depth + 1, new Set([...seen, up.comp]), at, read));
                    continue;
                }

                if (rest.length && typescript.isCallExpression(strip(this.expressions.literalOf(r.expr))!)) {
                    // Follow object-returning helpers before reading their fields, retaining each call's arms.
                    let sources = this.expressions.sources(r.expr, depth + 1, seen, at);
                    for (const key of rest) {
                        sources = sources.flatMap((source): Source[] => {
                            if ('marker' in source) {
                                return [source];
                            }
                            const object = strip(this.expressions.literalOf(source.expr));
                            let member = this.expressions.memberOfLiteral(object as ts.Expression | undefined, key);
                            if (object && typescript.isObjectLiteralExpression(object)) {
                                const properties = [...object.properties].reverse();
                                const field = properties.find((property) => typescript.isSpreadAssignment(property) || (property.name && typescript.isComputedPropertyName(property.name)) || propName(property.name) === key);
                                if (field && (typescript.isSpreadAssignment(field) || (field.name && typescript.isComputedPropertyName(field.name)) || !(typescript.isPropertyAssignment(field) || typescript.isShorthandPropertyAssignment(field)))) {
                                    return [{marker: true, src: read ?? r.expr, via: source.via, arms: source.arms}];
                                }
                                if (field && typescript.isPropertyAssignment(field)) {
                                    member = field.initializer;
                                } else if (field && typescript.isShorthandPropertyAssignment(field)) {
                                    member = field.name;
                                } else {
                                    member = undefined;
                                }
                            }
                            if (member) {
                                return this.expressions.sources({expr: member, via: source.via, arms: source.arms}, depth + 1, seen);
                            }

                            // A literal with no such own field supplies no value; an opaque caller stays visible.
                            if (object && typescript.isObjectLiteralExpression(strip(object))) {
                                return [];
                            }
                            return [{marker: true, src: read ?? r.expr, via: source.via, arms: source.arms}];
                        });
                    }
                    out.push(...sources);
                    const dflt = propPath.length === 1 ? this.defaultFor(comp, propPath[0]) : null;
                    if (dflt) {
                        for (const source of sources) {
                            if ('marker' in source) {
                                continue;
                            }
                            for (const missing of this.expressions.resolve(source.expr, depth + 1, seen).filter((value) => value.k === 'absent' && !value.nullValue)) {
                                out.push(...carryArms(this.expressions.sources(dflt, depth + 1, seen, [...source.via, ...(missing.via ?? [])]), missing.arms));
                            }
                        }
                    }
                } else {
                    // the object may be a local helper's parameter (`renderRoutes(extraProps)` -> `<Page {...extraProps}/>`):
                    // follow it to each call's argument
                    for (const obj of rest.length ? this.expressions.literalsOf(r.expr) : [r.expr]) {
                        let v: ts.Expression | undefined = obj;
                        for (const k of rest) {
                            v = this.expressions.memberOfLiteral(this.expressions.literalOf(v), k);
                            if (!v) {
                                break;
                            }
                        }
                        if (v) {
                            out.push(...this.expressions.sources(v, depth + 1, seen, at));
                            const dflt = propPath.length === 1 ? this.defaultFor(comp, propPath[0]) : null;
                            if (dflt) {
                                for (const missing of this.expressions.resolve(v, depth + 1, seen).filter((value) => value.k === 'absent' && !value.nullValue)) {
                                    out.push(...carryArms(this.expressions.sources(dflt, depth + 1, seen, [...at, ...(missing.via ?? [])]), missing.arms));
                                }
                            }
                        }
                    }
                }
            } else if (r.kind === 'up') {
                out.push(...this.onlyFromSources(comp, u, via.length, this.propSources(r.comp, r.path, depth + 1, new Set([...seen, r.comp]), at, read)));
            } else if (r.kind === 'default') {
                out.push(...this.expressions.sources(r.expr, depth + 1, seen, at));
            }
            if (out.length > MAX_USAGE_VALUES) {
                break;
            }
        }
        if (!(this.ix.usages.get(comp) ?? []).length) {
            const dflt = propPath.length === 1 ? this.defaultFor(comp, propPath[0]) : null;
            if (dflt) {
                out.push(...this.expressions.sources(dflt, depth + 1, seen, via));
            }
        }
        return out;
    }

    /**
     * A dynamic usage (`<props.as/>`, `createElement(props.inputComponent)`) renders this component only for
     * the instances whose usage chain supplied it: drop values that came through other instances.
     */
    private onlyFrom(comp: CodeNode, u: Usage, vals: Value[]): Value[] {
        const allowed = this.ix.dynamicVia.get(comp)?.get(u);
        if (!allowed) {
            return vals;
        }
        return vals.filter((v) => allowed.some((a) => prefixCompatible(a, v.via ?? [])));
    }

    /** Keep sources supplied through the dynamic mount that renders this component. */
    private onlyFromSources(comp: CodeNode, u: Usage, skip: number, srcs: Source[]): Source[] {
        const allowed = this.ix.dynamicVia.get(comp)?.get(u);
        if (!allowed) {
            return srcs;
        }
        return srcs.filter((s) => allowed.some((a) => prefixCompatible(a, s.via.slice(skip + 1))));
    }

    /** Resolves a props path at every place the component is used. Each value records the usage it came from. */
    resolveProps(comp: CodeNode, propPath: string[], depth: number, seen: Set<ts.Node>): Value[] {
        const sites = this.ix.usages.get(comp) ?? [];
        const dialogs = this.ix.dialogRefs.get(comp) ?? [];
        if (!sites.length && !dialogs.length) {
            const dflt = propPath.length === 1 ? this.defaultFor(comp, propPath[0]) : null;
            if (dflt) {
                return this.expressions.resolve(dflt, depth + 1, seen);
            }
            return [this.expressions.unres('component-has-no-static-usage', comp)];
        }
        const out: Value[] = [];
        const tagged = (vals: Value[], at: Loc) => vals.map((v) => ({...v, via: [at, ...(v.via ?? [])]}));
        for (const u of sites) {
            const node = usageNode(u);
            const vals = this.onlyFrom(comp, u, this.atUsage(comp, u, propPath, depth, seen));
            out.push(...tagged(vals, this.ix.where(node)));
            if (out.length > MAX_USAGE_VALUES) {
                out.push(truncated(this.ix.where(comp)));
                break;
            }
        }
        for (const ref of dialogs) {
            const at = this.ix.where(ref.node);
            const dp = this.dialogPropsOf(ref);
            const connected = this.ix.connects.has(comp) && this.connectMaySupply(comp, propPath[0]);
            let values: Value[] = dp ? this.expressions.descend(dp, propPath, depth, seen) : [{k: 'absent', at}];
            if (connected) {
                values = [{k: 'unres', why: 'from-connect', at}];
            } else {
                const fallback = propPath.length === 1 ? this.defaultFor(comp, propPath[0]) : null;
                if (fallback && values.some((value) => value.k === 'absent' && !value.nullValue)) {
                    const defaults = this.expressions.resolve(fallback, depth + 1, seen);
                    values = values.flatMap((value): Value[] => (value.k === 'absent' && !value.nullValue ? carryArms(defaults.map((item) => ({...item, via: value.via ?? item.via})), value.arms) : [value]));
                }
            }
            out.push(...tagged(values, at));
        }
        return out;
    }

    /** A sibling-prop default belongs to the mount that omitted it, not every mount of the component. */
    private defaultAt(comp: CodeNode, u: Usage, expression: ts.Expression, depth: number, seen: Set<ts.Node>): Value[] {
        if (seen.has(expression) || depth > MAX_RESOLVE_DEPTH) {
            return [this.expressions.unres('recursive-prop-default', expression)];
        }
        const path = this.propsPath(expression);
        if (path?.comp === comp && path.path.length) {
            return this.atUsage(comp, u, path.path, depth + 1, new Set([...seen, expression]));
        }
        const at = this.ix.where(usageNode(u));
        const mounts = new Set((this.ix.usages.get(comp) ?? []).map((usage) => this.ix.where(usageNode(usage))));
        return this.expressions.resolve(expression, depth + 1, seen).flatMap((value) => {
            const first = value.via?.[0];
            if (!first || !mounts.has(first)) {
                return [value];
            }
            return first === at ? [{...value, via: value.via!.slice(1)}] : [];
        });
    }

    /** Resolve one prop path at one mount, respecting spreads, defaults and connected overrides. */
    atUsage(comp: CodeNode, u: Usage, propPath: string[], depth: number, seen: Set<ts.Node>): Value[] {
        const at = this.ix.where(usageNode(u));

        // connect's state/dispatch props can override own props; omission or a false own prop cannot prove absence.
        if (this.ix.connects.has(comp) && this.connectMaySupply(comp, propPath[0])) {
            return [{k: 'unres', why: 'from-connect', at}];
        }
        const r = this.propAt(comp, u, propPath, seen);
        switch (r.kind) {
        case 'value': {
            // a field a keyFields entry names (`id={g.id}` with Group.id) is the identity itself: typed by the entry, not by
            // whatever object literals the field's values were built from
            const configured = !r.rest.length && this.keys.fieldOf(r.expr);
            if (configured && this.keys.keyFieldEntry(configured.owner, configured.field)) {
                const typed = this.keys.gapFor(strip(r.expr) as ts.Expression);
                if (typed.k === 'pat' && typeof typed.parts[0] !== 'string') {
                    this.keys.configuredField(typed.parts[0].gap, configured.owner, configured.field);
                }
                return [typed];
            }

            // a value this mount passes but the scan can't read is typed by the mount's own expression (section.key of a
            // MenuSection), not later by the prop it lands in, whose declared type says nothing about where it came from
            const vals = this.expressions.descend(r.expr, r.rest, depth, seen).map((value) => (!r.rest.length && value.k === 'unres' && value.why === 'runtime-value' && !value.truthy ? withFrom(this.keys.gapFor(strip(r.expr) as ts.Expression), value, this.ix.where(r.expr)) : value));
            const dflt = propPath.length === 1 ? this.defaultFor(comp, propPath[0]) : null;
            if (!dflt || !vals.some((value) => value.k === 'absent' && !value.nullValue)) {
                return vals;
            }
            const fallback = this.defaultAt(comp, u, dflt, depth + 1, seen);
            return vals.flatMap((value): Value[] => (value.k === 'absent' && !value.nullValue ? carryArms(fallback.map((item) => ({...item, via: value.via ?? item.via})), value.arms) : [value]));
        }
        case 'true':
            return [lit('true', undefined, 'boolean')];
        case 'up':
        case 'object': {
            const vals = r.kind === 'up' ? this.resolveProps(r.comp, r.path, depth + 1, new Set([...seen, r.comp])) : this.expressions.descend(r.expr, r.path, depth, seen);

            // a spread that may carry the prop but doesn't: the component's default applies
            const dflt = propPath.length === 1 ? this.defaultFor(comp, propPath[0]) : null;
            if (!dflt || !vals.some((v) => v.k === 'absent' && !v.nullValue)) {
                return vals;
            }
            const fallback = this.defaultAt(comp, u, dflt, depth + 1, seen);
            return vals.flatMap((v): Value[] => (v.k === 'absent' && !v.nullValue ? fallback.map((d) => ({...d, via: v.via ?? d.via}) as Value) : [v]));
        }
        case 'unknown':
            return [this.expressions.unres('spread-unknown', r.node)];
        case 'default':
            return this.defaultAt(comp, u, r.expr, depth + 1, seen);
        case 'connect':
            return [{k: 'unres', why: 'from-connect', at}];
        default:
            return [{k: 'absent', at}];
        }
    }
}
