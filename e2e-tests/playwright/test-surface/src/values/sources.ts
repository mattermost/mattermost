// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {carryArms} from './algebra.ts';
import type {KeyClassifier} from './keys.ts';
import type {PropTracer} from './props.ts';
import {assignmentsOf, isLet, pushesOf, symbolOf} from './type_utils.ts';
import type {Arm, Source} from './types.ts';

import {calleeName, isFunctionLike, propName, returnsOf, strip, type FunctionLike} from '../ast.ts';
import {MAX_ARRAY_SPREAD_DEPTH, MAX_PARAM_OBJECT_DEPTH, MAX_RESOLVE_DEPTH} from '../limits.ts';
import {type Loc, type ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';

export const LIST_METHODS = ['map', 'forEach', 'filter', 'flatMap', 'find', 'some', 'every'];

/** Trace expression sources through local bindings, collection callbacks and component prop mounts. */
export class SourceTracer {
    private readonly ix: ProgramIndex;
    private readonly checker: ts.TypeChecker;
    private readonly keys: KeyClassifier;
    private readonly props: PropTracer;
    constructor(ix: ProgramIndex, keys: KeyClassifier, props: PropTracer) {
        this.ix = ix;
        this.checker = ix.checker;
        this.keys = keys;
        this.props = props;
    }

    private propertyIndex: Map<string, ts.PropertyAssignment[]> | null = null;

    /**
     * Where a member of a typed parameter is set, when no call site can say (a method stored in a lookup table and
     * called through it): the object literals of the parameter's declared type that set the member. System Console
     * custom settings are rendered this way, `setting.component` from `{type: 'custom', component: PolicyList}`.
     */
    typedMemberSources(x: ts.PropertyAccessExpression, inUnion = false): ts.Expression[] {
        const obj = strip(x.expression) as ts.Expression;
        const declared = this.declaredType(obj);
        if (!declared) {
            return [];
        }
        const alias = declared.aliasSymbol ?? declared.getSymbol();
        if (!alias) {
            return [];
        }
        if (!this.propertyIndex) {
            this.propertyIndex = new Map();
            const index = this.propertyIndex;
            const walk = (n: ts.Node) => {
                if (typescript.isPropertyAssignment(n)) {
                    const name = propName(n.name);
                    if (name) {
                        index.set(name, [...(index.get(name) ?? []), n]);
                    }
                }
                typescript.forEachChild(n, walk);
            };
            this.ix.files.forEach((sf) => walk(sf));
        }

        // with inUnion, also literals typed by a union that includes the parameter's type (a list of definitions, each
        // entry one kind of the union): every kind's member, which over-approximates but never misses one. A kind
        // extended where it's used (`LDAPDefinitionSettingButton`, a button kind & its action) matches the union's kind
        // of the same `type` it can be assigned to: the union is flattened, so its kinds no longer carry their aliases.
        const kind = (t: ts.Type) => {
            const p = t.getProperty('type');
            return p ? this.checker.typeToString(this.checker.getTypeOfSymbol(p)) : undefined;
        };
        const declaredKind = inUnion ? kind(declared) : undefined;
        const matches = (t: ts.Type) => (t.aliasSymbol ?? t.getSymbol()) === alias ||
            Boolean(declaredKind && kind(t) === declaredKind && this.checker.isTypeAssignableTo(declared, t));
        return (this.propertyIndex.get(x.name.text) ?? []).filter((p) => {
            const t = this.checker.getContextualType(p.parent);
            return Boolean(t && (matches(t) || (inUnion && t.isUnion() && t.types.some(matches))));
        }).map((p) => p.initializer);
    }

    /**
     * The declared type of a typed parameter (`setting`) or of a member of one (`props.setting`, the member's own
     * declared type): what a definition literal is written against, not what control flow narrowed it to.
     */
    private declaredType(obj: ts.Expression): ts.Type | undefined {
        if (typescript.isIdentifier(obj)) {
            const d = this.valueDecl(obj);
            return d && typescript.isParameter(d) && d.type ? this.checker.getTypeFromTypeNode(d.type) : undefined;
        }
        if (typescript.isPropertyAccessExpression(obj) && this.declaredType(strip(obj.expression) as ts.Expression)) {
            const member = this.checker.getSymbolAtLocation(obj.name)?.valueDeclaration;
            return member && typescript.isPropertySignature(member) && member.type ? this.checker.getTypeFromTypeNode(member.type) : undefined;
        }
        return undefined;
    }

    /** Arguments from different calls of one helper cannot form one rendered value. */
    atCall<T extends {arms?: Arm[]}>(values: T[], fn: FunctionLike, call: ts.CallExpression): T[] {
        const calls = this.ix.calls.get(fn) ?? [];
        const index = calls.indexOf(call);
        const arms = Array.from({length: Math.ceil(Math.log2(calls.length))}, (_, bit) => ({key: `call:${this.ix.where(fn)}:${bit}`, when: Boolean(index & (2 ** bit))}));
        return carryArms(values, arms);
    }

    /** A qualified scalar component prop is the declared identity boundary, before tracing its caller's value. */
    declaredKeyProp(expr: ts.Expression): boolean {
        const field = this.keys.fieldOf(expr);
        return Boolean(field && this.props.propsPath(expr)?.comp && !this.checker.isArrayLikeType(this.checker.getNonNullableType(this.checker.getTypeAtLocation(expr))) && this.keys.keyFieldEntry(field.owner, field.field)?.module);
    }

    // ---- value sources ------------------------------------------------------------------

    /** Source expressions that can flow into `e`, each with its usage chain. */
    sources(e: ts.Expression | Source, depth = 0, seen = new Set<ts.Node>(), via: Loc[] = []): Source[] {
        if ('marker' in e) {
            return [e];
        }
        if ('expr' in e && 'via' in e) {
            return carryArms(this.sources(e.expr, depth, seen, e.via), e.arms);
        }
        const x = strip(e) as ts.Expression;
        if (!x || depth > MAX_RESOLVE_DEPTH) {
            return [];
        }
        if (this.declaredKeyProp(x)) {
            return [{expr: x, via}];
        }
        const pp = this.props.propsPath(x);
        if (pp && pp.comp && pp.path.length && !seen.has(pp.comp)) {
            const out: Source[] = [];
            const s2 = new Set([...seen, pp.comp]);
            out.push(...this.props.propSources(pp.comp, pp.path, depth, s2, via, x));

            // modals opened with {dialogType: X, dialogProps: {...}} or <ToggleModalButton dialogType={X} dialogProps={...}>
            for (const ref of this.ix.dialogRefs.get(pp.comp) ?? []) {
                let v: ts.Expression | undefined = this.props.dialogPropsOf(ref);
                for (const k of pp.path) {
                    v = this.memberOfLiteral(this.literalOf(v), k);
                    if (!v) {
                        break;
                    }
                }
                if (v) {
                    out.push(...this.sources(v, depth + 1, s2, [...via, this.ix.where(ref.node)]));
                }
            }

            // no usage provides it (connect(), library-rendered): the props expression itself is the source
            return out.length ? out : [{expr: x, via}];
        }
        if (typescript.isIdentifier(x)) {
            const d = this.valueDecl(x);
            if (d && typescript.isVariableDeclaration(d) && (d.initializer || isLet(d))) {
                if (seen.has(d)) {
                    return [];
                }
                const sym = symbolOf(this.checker, x)!;
                const exprs = [...(d.initializer ? [d.initializer] : []), ...assignmentsOf(d, sym, this.checker)];
                const s2 = isLet(d) ? new Set([...seen, d]) : seen;
                return exprs.flatMap((ex) => this.sources(ex, depth + 1, s2, via));
            }
            if (d && typescript.isParameter(d)) {
                const listed = this.callbackItems(d);
                const items = listed && this.narrowedItems(x, listed);
                if (items) {
                    return items.flatMap((it) => ('marker' in it ? [{...it, via: [...via, ...it.via]}] : this.sources(it.expr, depth + 1, seen, [...via, ...it.via])));
                }
                const fn = d.parent as FunctionLike;
                const idx = fn.parameters.indexOf(d);
                const cs = this.ix.calls.get(fn);
                if (cs && cs.length && !seen.has(fn)) {
                    const s2 = new Set([...seen, fn]);
                    return cs.flatMap((c) => this.atCall(c.arguments[idx] ? this.sources(c.arguments[idx], depth + 1, s2, via) : [], fn, c));
                }
            }
            return [{expr: x, via}];
        }
        if (typescript.isCallExpression(x)) {
            const n = calleeName(x);
            if (n === 'useMemo') {
                const f = strip(x.arguments[0]);
                return f && isFunctionLike(f) ? returnsOf(f).flatMap((r) => this.sources(r, depth + 1, seen, via)) : [];
            }
            if (n === 'useCallback' && x.arguments[0]) {
                return this.sources(x.arguments[0], depth + 1, seen, via);
            }

            const callee = strip(x.expression);
            const csym = (typescript.isIdentifier(callee) || typescript.isPropertyAccessExpression(callee)) ? this.checker.getSymbolAtLocation(callee) : undefined;
            const cfn = csym && this.ix.resolveSymbolToNode(csym);
            if (cfn && isFunctionLike(cfn) && cfn.body && !seen.has(cfn) && !this.ix.isLibraryNode(cfn)) {
                const s2 = new Set([...seen, cfn]);

                // through this call only: a parameter's sources carry the arm of the call they came from (atCall), and
                // the other calls' arguments are not what this call returns
                // (carried on what it returns too, so a returned list's elements expanded later keep to this call)
                const here = this.atCall([{} as {arms?: Arm[]}], cfn, x)[0].arms;
                const sources = returnsOf(cfn).flatMap((r) => this.sources(r, depth + 1, s2, via));
                return here?.length ? carryArms(sources, here) : sources;
            }
            if (typescript.isPropertyAccessExpression(callee) && ['filter', 'slice', 'sort', 'concat', 'reverse', 'toSorted'].includes(n)) {
                return [
                    ...this.sources(callee.expression, depth + 1, seen, via),
                    ...(n === 'concat' ? x.arguments.flatMap((a) => this.sources(a, depth + 1, seen, via)) : []),
                ];
            }
        }
        if (typescript.isConditionalExpression(x)) {
            return [...this.sources(x.whenTrue, depth + 1, seen, via), ...this.sources(x.whenFalse, depth + 1, seen, via)];
        }
        if (typescript.isBinaryExpression(x) && [typescript.SyntaxKind.BarBarToken, typescript.SyntaxKind.QuestionQuestionToken].includes(x.operatorToken.kind)) {
            return [...this.sources(x.left, depth + 1, seen, via), ...this.sources(x.right, depth + 1, seen, via)];
        }
        return [{expr: x, via}];
    }

    /** An identifier bound to an object literal -> that literal. */
    literalOf(v: ts.Expression | undefined): ts.Expression | undefined {
        const x = strip(v) as ts.Expression | undefined;
        if (x && typescript.isIdentifier(x)) {
            const d = this.valueDecl(x);
            if (d && typescript.isVariableDeclaration(d) && d.initializer) {
                return d.initializer;
            }
        }
        return x;
    }

    /** The objects an expression can be: itself, a variable's initializer, or a parameter's argument at each call. */
    literalsOf(v: ts.Expression, depth = 0): ts.Expression[] {
        const x = strip(v) as ts.Expression;
        if (depth > MAX_PARAM_OBJECT_DEPTH || !typescript.isIdentifier(x)) {
            return [x];
        }
        const d = this.valueDecl(x);
        if (d && typescript.isVariableDeclaration(d) && d.initializer) {
            return [d.initializer];
        }
        if (d && typescript.isParameter(d)) {
            const fn = d.parent as FunctionLike;
            const idx = fn.parameters.indexOf(d);
            const args = (this.ix.calls.get(fn) ?? []).map((c) => c.arguments[idx]).filter((a): a is ts.Expression => Boolean(a));
            if (args.length) {
                return args.flatMap((a) => this.literalsOf(a, depth + 1));
            }
        }
        return [x];
    }

    /** Read a named property from a literal expression when its initializer is explicit. */
    memberOfLiteral(v: ts.Expression | undefined, k: string): ts.Expression | undefined {
        const o = strip(v);
        if (!o || !typescript.isObjectLiteralExpression(o)) {
            return undefined;
        }
        const q = o.properties.find((p) => propName(p.name) === k);
        if (q && typescript.isPropertyAssignment(q)) {
            return q.initializer;
        }
        if (q && typescript.isShorthandPropertyAssignment(q)) {
            return q.name;
        }
        return undefined;
    }

    /**
     * Elements of an array that may come from several sources. A source that isn't an
     * array literal becomes a marker, so known elements are kept and the rest is a typed gap.
     */
    arrayElements(e: ts.Expression | Source, depth = 0): Source[] | null {
        if (depth > MAX_ARRAY_SPREAD_DEPTH) {
            return null;
        }
        const out: Source[] = [];
        let literal = false;
        for (const src of this.sources(e)) {
            if ('marker' in src) {
                out.push(src);
                continue;
            }
            const arr = strip(src.expr);

            // `list.map(cb)`, `list?.map(cb)` too (an optional list is `T[] | undefined`): the elements are cb's returns
            if (arr && typescript.isCallExpression(arr) && typescript.isPropertyAccessExpression(arr.expression) && arr.expression.name.text === 'map' && this.checker.isArrayLikeType(this.checker.getNonNullableType(this.checker.getTypeAtLocation(arr.expression.expression)))) {
                const callback = arr.arguments[0] && this.ix.unwrapExpr(arr.arguments[0]);
                if (callback && isFunctionLike(callback)) {
                    literal = true;
                    out.push(...returnsOf(callback).map((expr) => ({expr, via: src.via, arms: src.arms})));
                    continue;
                }
            }
            if (!typescript.isArrayLiteralExpression(arr)) {
                out.push({marker: true, src: src.expr, via: src.via, arms: src.arms});
                continue;
            }
            literal = true;
            for (const el of arr.elements) {
                // a spread of a field a keyFields entry names (`...nodes` of Props.nodes): the field is the identity, so
                // its elements are that entry's, not whatever the mount happened to build the list from
                const field = typescript.isSpreadElement(el) ? this.keys.fieldOf(el.expression) : null;
                if (typescript.isSpreadElement(el) && field && this.keys.keyFieldEntry(field.owner, field.field)) {
                    out.push({marker: true as const, src: el.expression, via: src.via, arms: src.arms});
                } else if (typescript.isSpreadElement(el)) {
                    out.push(...(this.arrayElements({expr: el.expression, via: src.via, arms: src.arms}, depth + 1) ?? [{marker: true as const, src: el.expression, via: src.via, arms: src.arms}]));
                } else {
                    out.push({expr: el, via: src.via, arms: src.arms});
                }
            }

            // A list started empty and filled with push() takes those values as its items. An empty literal has
            // no items; an unknown typed collection keeps the marker above so its element type can supply a key.
            const decl = arr.parent;
            if (typescript.isVariableDeclaration(decl) && decl.initializer && strip(decl.initializer) === arr && typescript.isIdentifier(decl.name)) {
                const sym = this.checker.getSymbolAtLocation(decl.name);
                for (const pushed of sym ? pushesOf(decl, sym, this.checker) : []) {
                    out.push({expr: pushed, via: src.via});
                }
            }
        }
        if (out.length || literal) {
            return out;
        }
        return null;
    }

    /** The arrays a `const f = (x) => …` is passed to by name, as `arr.map(f)` (or forEach, filter, ...), in its file. */
    listsPassedTo(fn: FunctionLike): ts.Expression[] {
        const decl = fn.parent;
        if (!decl || !typescript.isVariableDeclaration(decl) || !typescript.isIdentifier(decl.name)) {
            return [];
        }
        const sym = this.checker.getSymbolAtLocation(decl.name);
        const lists: ts.Expression[] = [];
        const visit = (n: ts.Node) => {
            if (typescript.isCallExpression(n) && n.arguments.length && typescript.isIdentifier(n.arguments[0]) && this.checker.getSymbolAtLocation(n.arguments[0]) === sym) {
                const callee = strip(n.expression);
                if (typescript.isPropertyAccessExpression(callee) && LIST_METHODS.includes(callee.name.text)) {
                    lists.push(callee.expression);
                }
            }
            typescript.forEachChild(n, visit);
        };
        visit(decl.getSourceFile());
        return lists;
    }

    /** Fields destructured from a for-of item use the same bounded literal-list sources as map callbacks. */
    forOfBinding(binding: ts.BindingElement): {items: Source[]; path: string[]} | null {
        const path: string[] = [];
        let holder: ts.Node = binding;
        while (typescript.isBindingElement(holder)) {
            if (holder.dotDotDotToken || holder.initializer || !typescript.isObjectBindingPattern(holder.parent)) {
                return null;
            }
            const name = propName(holder.propertyName ?? holder.name);
            if (name === null) {
                return null;
            }
            path.unshift(name);
            holder = holder.parent.parent;
        }
        if (!typescript.isVariableDeclaration(holder) || !typescript.isVariableDeclarationList(holder.parent) || !(holder.parent.flags & typescript.NodeFlags.Const) || !typescript.isForOfStatement(holder.parent.parent)) {
            return null;
        }
        const items = this.arrayElements(holder.parent.parent.expression);
        return items && {items, path};
    }

    /** A parameter of a callback passed to arr.map/forEach/filter/...: the array's elements, if it is a fixed list. */
    callbackItems(param: ts.ParameterDeclaration | undefined): Source[] | null {
        if (!param) {
            return null;
        }
        const fn = param.parent;
        if (!fn.parent || !typescript.isCallExpression(fn.parent) || (fn as FunctionLike).parameters?.[0] !== param) {
            return null;
        }
        const callee = strip(fn.parent.expression);
        if (!typescript.isPropertyAccessExpression(callee) || !LIST_METHODS.includes(callee.name.text)) {
            return null;
        }
        return this.arrayElements(callee.expression);
    }

    /**
     * The items of a list callback's parameter that a reference to it can still hold: `permissions.map((group) =>
     * typeof group === 'string' ? renderPermission(group) : renderGroup(group))` passes only the strings to
     * renderPermission, though the list also holds groups. An item is dropped only when its type is proven disjoint from
     * the checker's narrowed type at the reference: a `string` item stays under `value === 'known'` (it can hold
     * 'known'), a group object goes under `typeof group === 'string'`.
     */
    narrowedItems(reference: ts.Expression, items: Source[]): Source[] {
        const loose = typescript.TypeFlags.Any | typescript.TypeFlags.Unknown;
        const narrowed = this.checker.getTypeAtLocation(reference);
        if (narrowed.flags & loose) {
            return items;
        }
        const narrowedMembers = narrowed.isUnion() ? narrowed.types : [narrowed];
        return items.filter((item) => {
            const type = 'marker' in item ? this.checker.getIndexTypeOfType(this.checker.getTypeAtLocation(item.src), typescript.IndexKind.Number) : this.checker.getTypeAtLocation(item.expr);
            if (!type || type.flags & loose) {
                return true;
            }
            const members = type.isUnion() ? type.types : [type];
            return members.some((member) => narrowedMembers.some((target) => !this.disjoint(member, target)));
        });
    }

    /**
     * Whether no value can have both types: neither is assignable to the other, and they are two primitives (`'a'` and
     * `'b'`, `string` and `number`) or a primitive and an object type. Two object types may still overlap.
     */
    private disjoint(a: ts.Type, b: ts.Type): boolean {
        if (this.checker.isTypeAssignableTo(a, b) || this.checker.isTypeAssignableTo(b, a)) {
            return false;
        }
        const primitive = typescript.TypeFlags.StringLike | typescript.TypeFlags.NumberLike | typescript.TypeFlags.BooleanLike | typescript.TypeFlags.BigIntLike | typescript.TypeFlags.ESSymbolLike | typescript.TypeFlags.Null | typescript.TypeFlags.Undefined | typescript.TypeFlags.Void;
        const object = (type: ts.Type) => Boolean(type.flags & typescript.TypeFlags.Object) || type.isIntersection();
        const isPrimitive = (type: ts.Type) => Boolean(type.flags & primitive);
        return (isPrimitive(a) && isPrimitive(b)) || (isPrimitive(a) && object(b)) || (object(a) && isPrimitive(b));
    }

    /** Find the value declaration behind an identifier, following import aliases. */
    private valueDecl(id: ts.Identifier): ts.Declaration | undefined {
        const sym = symbolOf(this.checker, id);
        if (!sym) {
            return undefined;
        }
        if (sym.flags & typescript.SymbolFlags.Alias) {
            try {
                return this.checker.getAliasedSymbol(sym).valueDeclaration;
            } catch {
                return undefined;
            }
        }
        return sym.valueDeclaration;
    }

    /** Module-level constants reached by a property chain, incl. namespace imports (utils.X.y). */
    constantChain(e: ts.Expression): {init?: ts.Expression; items?: Source[]; rest: string[]} | null {
        const names: string[] = [];
        let cur = strip(e) as ts.Expression;
        while (typescript.isPropertyAccessExpression(cur)) {
            names.unshift(cur.name.text);
            cur = strip(cur.expression) as ts.Expression;
        }
        if (!typescript.isIdentifier(cur) || !names.length) {
            return null;
        }
        let sym = symbolOf(this.checker, cur);
        if (!sym) {
            return null;
        }
        if (sym.flags & typescript.SymbolFlags.Alias) {
            sym = this.checker.getAliasedSymbol(sym);
        }
        if (sym.flags & typescript.SymbolFlags.ValueModule) {
            let ex = this.checker.getExportsOfModule(sym).find((x) => x.getName() === names[0]);
            if (!ex) {
                return null;
            }
            if (ex.flags & typescript.SymbolFlags.Alias) {
                ex = this.checker.getAliasedSymbol(ex);
            }
            const d = ex.valueDeclaration;
            if (d && typescript.isVariableDeclaration(d) && d.initializer) {
                return {init: d.initializer, rest: names.slice(1)};
            }
            return null;
        }
        const d = sym.valueDeclaration ?? sym.declarations?.[0];
        if (d && typescript.isVariableDeclaration(d) && d.initializer) {
            return {init: d.initializer, rest: names};
        }

        // `import utils from './utils'` of `export default {MuteChannel, ...}`: the exported object
        if (d && typescript.isExportAssignment(d)) {
            return {init: d.expression, rest: names};
        }
        if (d && typescript.isParameter(d) && !this.props.propsPath(cur)) {
            const srcs = this.sources(cur);
            if (srcs.length && !(srcs.length === 1 && 'expr' in srcs[0] && srcs[0].expr === cur)) {
                return {items: srcs, rest: names};
            }
        }
        if (d && typescript.isBindingElement(d)) {
            const loop = this.forOfBinding(d);
            if (loop) {
                return {items: loop.items, rest: [...loop.path, ...names]};
            }
            const bp = this.props.bindingPath(d);
            if (bp && bp.root.kind === 'param') {
                const items = this.callbackItems(bp.root.fn.parameters[0]);
                if (items) {
                    return {items, rest: [...bp.path, ...names]};
                }
            }

            // `const {first} = opts; first.value`: the path from the destructured value
            if (bp && bp.root.kind === 'expr') {
                return {init: bp.root.expr, rest: [...bp.path, ...names]};
            }
        }
        return null;
    }
}
