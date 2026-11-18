// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {attrValue, type JsxTag, calleeName, isFunctionLike, propName, returnsOf, shortText, strip, typeText, type FunctionLike} from './ast.ts';
import {type KeyFieldAllow} from './config.ts';
import {MAX_HELPER_RETURNS, MAX_RESOLVE_DEPTH} from './limits.ts';
import type {Diagnostic} from './manifest_types.ts';
import {usageNode, type CodeNode, type Loc, type ProgramIndex} from './program_index.ts';
import {typescript} from './typescript.ts';
import {carryArms, concat, conditionContexts, distinctValues, distribute, isFalsy, isTruthy, lit, mergeArms, perInstance, prefixCompatible, TOO_MANY_VALUES, truncated, union, withArm, withFrom, withoutEmptyMember} from './values/algebra.ts';
import {GenericInference} from './values/generic.ts';
import {ImportedWrites} from './values/imported_writes.ts';
import {KeyClassifier} from './values/keys.ts';
import {PropTracer} from './values/props.ts';
import {SiteGuards} from './values/site_guards.ts';
import {LIST_METHODS, SourceTracer} from './values/sources.ts';
import {assignmentsOf, enclosingFunction, isLet, stringLiteralsOf} from './values/type_utils.ts';
import type {Env, Gap, PropsRef, Source, Value} from './values/types.ts';
export {concat, distribute, gapsOf, isTruncated, lit, perInstance, templateOf, TOO_MANY_VALUES} from './values/algebra.ts';
export {assignmentsOf, pushesOf, stringLiteralsOf} from './values/type_utils.ts';
type SpreadFieldValue = Value & {missingField?: true};

export type {Gap, Part, Source, Value} from './values/types.ts';

/**
 * Resolves expressions to the strings they can produce, following props to every usage
 * (with provenance), spreads, rest props, local objects, constants (incl. namespace imports),
 * useMemo, helper-function returns, and fixed lists behind .map callbacks.
 */
export class Resolver {
    private readonly sourceTrace: SourceTracer;

    /** Trace the expressions supplying a value, retaining its mount provenance. */
    sources(e: ts.Expression | Source, depth = 0, seen = new Set<ts.Node>(), via: Loc[] = []): Source[] {
        return this.sourceTrace.sources(e, depth, seen, via);
    }

    /** Find literal assignments to a typed callback member. */
    typedMemberSources(x: ts.PropertyAccessExpression, inUnion = false): ts.Expression[] {
        return this.sourceTrace.typedMemberSources(x, inUnion);
    }

    /** Resolve a locally declared array and each element's provenance. */
    arrayElements(e: ts.Expression | Source, depth = 0): Source[] | null {
        return this.sourceTrace.arrayElements(e, depth);
    }

    private readonly props: PropTracer;

    /** Identify the component owning a node. */
    componentOf(node: ts.Node): CodeNode | null {
        return this.props.componentOf(node);
    }

    /** Identify a prop read and its component owner. */
    propsPath(e: ts.Node): PropsRef | null {
        return this.props.propsPath(e);
    }

    /** Follow all prop reads that contribute to an expression. */
    propsReads(e: ts.Expression, depth = 0, seen = new Set<ts.Node>()): PropsRef[] {
        return this.props.propsReads(e, depth, seen);
    }

    /** Resolve a prop at every indexed mount of its component. */
    resolveProps(comp: CodeNode, propPath: string[], depth: number, seen: Set<ts.Node>): Value[] {
        return this.props.resolveProps(comp, propPath, depth, seen);
    }

    /** Follow a rest binding back to its component props. */
    restPropsOf(e: ts.Expression): PropsRef | null {
        return this.props.restPropsOf(e);
    }

    /** Whether the index recognizes a function as a component. */
    isComponentFn(fn: FunctionLike | undefined): boolean {
        return this.props.isComponentFn(fn);
    }
    private readonly keys: KeyClassifier;
    private readonly generics: GenericInference;
    private readonly siteGuards: SiteGuards;
    private readonly importedWrites: ImportedWrites;
    get keyFieldDiagnostics(): Diagnostic[] {
        return this.keys.keyFieldDiagnostics;
    }

    /** The declared identity of an expression's runtime key. */
    gapFor(e: ts.Expression): Value {
        return this.keys.gapFor(e);
    }
    private readonly ix: ProgramIndex;
    private readonly checker: ts.TypeChecker;

    constructor(ix: ProgramIndex) {
        this.ix = ix;
        this.importedWrites = new ImportedWrites(ix);
        this.checker = ix.checker;
        this.siteGuards = new SiteGuards(ix, (guard, evaluate) => {
            const condition = this.condition(guard.expr, 0, new Set(), null, true);
            const values = this.narrowing(guard.expr, guard.when, evaluate);
            return condition ? distribute(values, condition, guard.when) : values;
        });
        this.keys = new KeyClassifier(ix);
        this.generics = new GenericInference(ix, this.keys);
        this.props = new PropTracer(ix, this.keys, {
            sources: (...args) => this.sourceTrace.sources(...args),
            literalOf: (...args) => this.sourceTrace.literalOf(...args),
            literalsOf: (...args) => this.sourceTrace.literalsOf(...args),
            memberOfLiteral: (...args) => this.sourceTrace.memberOfLiteral(...args),
            resolve: (...args) => this.resolve(...args),
            unres: (...args) => this.unres(...args),
            descend: (...args) => this.descend(...args),
        });
        this.sourceTrace = new SourceTracer(ix, this.keys, this.props);
    }

    /** The symbol an identifier refers to; for a shorthand property `{x}`, the variable `x`, not the property. */
    private symbolOf(n: ts.Node): ts.Symbol | undefined {
        if (n.parent && typescript.isShorthandPropertyAssignment(n.parent) && n.parent.name === n) {
            return this.checker.getShorthandAssignmentValueSymbol(n.parent);
        }
        return this.checker.getSymbolAtLocation(n);
    }

    /** Represent an unreadable expression at its source, retaining known object truthiness. */
    private unres(why: string, n?: ts.Node): Value {
        const v: Value = {k: 'unres', why, at: n ? this.ix.where(n) : ''};
        return n && this.alwaysTruthy(n) ? {...v, truthy: true} : v;
    }

    /** A value the program can't know but whose type is always truthy: a function or object that is never null or undefined. */
    private alwaysTruthy(n: ts.Node): boolean {
        let t: ts.Type;
        try {
            t = this.checker.getTypeAtLocation(n);
        } catch {
            return false;
        }
        const parts = t.isUnion() ? t.types : [t];
        return parts.every((p) => (p.flags & typescript.TypeFlags.Object) !== 0 && !(p.flags & (typescript.TypeFlags.Any | typescript.TypeFlags.Unknown)));
    }

    /**
     * A condition's identity across expressions: the declaration of the value it tests (`isX`,
     * `!isX`, `props.isX`), or a stable strict comparison with a string literal, and whether it's negated.
     */
    private readonly armConditions = new Map<string, ts.Expression>();

    private armKey(e: ts.Expression): {key: string; negate: boolean; origin: string; reference?: ts.Expression; literal?: string} | null {
        let x = strip(e) as ts.Expression;
        let negate = false;
        while (typescript.isPrefixUnaryExpression(x) && x.operator === typescript.SyntaxKind.ExclamationToken) {
            negate = !negate;
            x = strip(x.operand) as ts.Expression;
        }
        let comparison: string | undefined;
        if (typescript.isBinaryExpression(x) && [typescript.SyntaxKind.EqualsEqualsEqualsToken, typescript.SyntaxKind.ExclamationEqualsEqualsToken].includes(x.operatorToken.kind)) {
            let reference = strip(x.left)!;
            let literal = strip(x.right)!;
            if (typescript.isStringLiteralLike(reference)) {
                [reference, literal] = [literal, reference];
            }
            const owner = enclosingFunction(e);
            if (!typescript.isStringLiteralLike(literal) || !owner || !this.siteGuards.stable(e, owner.getLastToken() ?? e)) {
                return null;
            }
            comparison = literal.text;
            negate = negate !== (x.operatorToken.kind === typescript.SyntaxKind.ExclamationEqualsEqualsToken);
            x = reference;
        }
        if (!typescript.isIdentifier(x) && !typescript.isPropertyAccessExpression(x)) {
            return null;
        }
        const path: string[] = [];
        let root: ts.Expression = x;
        while (typescript.isPropertyAccessExpression(root)) {
            path.unshift(root.name.text);
            root = strip(root.expression) as ts.Expression;
        }
        if (!typescript.isIdentifier(root) && root.kind !== typescript.SyntaxKind.ThisKeyword) {
            return null;
        }
        const decl = typescript.isIdentifier(root) ? this.checker.getSymbolAtLocation(root)?.declarations?.[0] : enclosingFunction(e);
        if (!decl) {
            return null;
        }

        // a property is one value only within one component's render: key it by the enclosing function too
        const fn = comparison !== undefined || typescript.isPropertyAccessExpression(x) ? enclosingFunction(e) : null;
        const key = `${decl.getSourceFile().fileName}:${decl.pos}:${JSON.stringify(path)}${fn ? `@${fn.pos}` : ''}${comparison === undefined ? '' : `===${JSON.stringify(comparison)}`}`;
        const origin = this.ix.where(e);
        this.armConditions.set(origin, e);
        return {key, negate, origin, ...(comparison === undefined ? {} : {reference: x, literal: comparison})};
    }

    /** Truth of the same stable reference in a resolved conditional tag arm. */
    branchTruth(expression: ts.Expression, branch: Value, site: ts.Node): boolean | 'unstable' | null {
        const identity = this.armKey(expression);
        if (!identity) {
            return null;
        }
        const arm = branch.arms?.find((item) => item.key === identity.key);
        const origins = arm?.origins;
        const stable = origins?.length && origins.every((origin) => {
            const condition = this.armConditions.get(origin);
            return condition && this.siteGuards.stable(condition, site);
        });
        if (!arm) {
            return null;
        }
        return stable ? arm.when !== identity.negate : 'unstable';
    }

    /**
     * Runtime data whose type upstream says less than the type where it's read (the list passes
     * `PostDraft | ScheduledPost`, the row reads `(item as ScheduledPost).id`): the reading here
     * types the key, and the value keeps the usage chain it came through.
     */
    private typedHere(v: Value, x: ts.Expression): Value {
        const g = v.k === 'pat' && v.parts.length === 1 ? v.parts[0] : null;
        if (!g || typeof g === 'string' || g.gap.kind !== 'string') {
            return v;
        }
        const here = this.gapFor(x);
        const hg = here.k === 'pat' ? here.parts[0] : null;
        return hg && typeof hg !== 'string' && hg.gap.kind !== 'string' ? {...here, ...(v.via ? {via: v.via} : {}), ...(v.arms ? {arms: v.arms} : {})} : v;
    }

    /** Runtime data reached through a props path: the type of `expr.rest...`. */
    private dataGap(expr: ts.Expression, rest: string[], elementOf = false): Value {
        let t: ts.Type | null = this.checker.getTypeAtLocation(expr);
        if (elementOf && t) {
            // `field.options?.map(…)` is `T[] | undefined`: the element is the array's, not the union's
            const array = this.checker.getNonNullableType(t);
            t = this.checker.getIndexTypeOfType(array, typescript.IndexKind.Number) ?? t;
        }
        let owner: ts.Type | null = null;
        let field: string | null = null;
        for (const k of rest) {
            if (!t) {
                break;
            }

            // `teams.find(…).name`: the property of the value when there is one (`Team | undefined` -> `Team`)
            t = this.checker.getNonNullableType(t);
            owner = t;
            field = k;
            const prop = t.getProperty(k);
            t = prop ? this.checker.getTypeOfSymbolAtLocation(prop, expr) : null;
        }
        const info: Gap = {kind: 'string', type: t ? typeText(this.checker, t) : 'unknown', expr: shortText(expr, 40) + (elementOf ? '[]' : '') + (rest.length ? '.' + rest.join('.') : '')};
        const origin = this.keys.classify(info, t, owner, field);
        this.keys.configuredField(info, origin.owner, origin.field);

        // an element of an array field itself (`...nodes` of a destructured prop): that field's keyFields entry
        if (elementOf && !rest.length && info.kind === 'string') {
            const array = this.keys.fieldOf(expr);
            if (array) {
                this.keys.configuredField(info, array.owner, array.field);
            }

            // an element of a record's keys reached through a helper's return (`orderAreas(byArea)` returning
            // `Object.keys(findingsByArea).sort(…)`): the record's keys entry
            const keysCall = strip(expr) as ts.Expression;
            const callee = typescript.isCallExpression(keysCall) ? strip(keysCall.expression) : undefined;
            if (callee && typescript.isPropertyAccessExpression(callee) && callee.name.text === 'keys' && typescript.isIdentifier(callee.expression) && callee.expression.text === 'Object' && this.isGlobalObject(callee.expression) && (keysCall as ts.CallExpression).arguments[0]) {
                this.recordKeys(info, (keysCall as ts.CallExpression).arguments[0]);
            }
        }
        return {k: 'pat', parts: [{gap: info}]};
    }

    /** Read the non-null literal alternatives of an expression’s checker type. */
    private literalsFromType(e: ts.Expression): Value[] | null {
        const t = this.checker.getTypeAtLocation(e);
        if (t.isStringLiteral()) {
            return [lit(t.value)];
        }
        const ls = stringLiteralsOf(t);
        const source = t.aliasSymbol?.getName();
        return ls ? ls.map((s) => ({...lit(s), ...(source ? {setSource: source} : {})})) : null;
    }

    private readonly narrowed = new Map<string, 'truthy' | 'present' | 'defined' | 'nonNull'>();

    /** A reference a condition can narrow: an identifier or a props path, keyed by where it is declared. */
    private narrowKey(e: ts.Expression): string | null {
        if (typescript.isIdentifier(e)) {
            const d = this.symbolOf(e)?.valueDeclaration;
            return d ? `${d.getSourceFile().fileName}:${d.pos}:${e.text}` : null;
        }
        if (typescript.isPropertyAccessExpression(e)) {
            const comp = this.props.componentOf(e);
            return comp ? `${comp.getSourceFile().fileName}:${comp.pos}:${e.getText()}` : null;
        }
        return null;
    }

    /** Resolves a branch with the condition's reference narrowed: truthy in the `when` branch (`x ?`), or falsy-free under `!x` in the other. */
    private narrowing<T>(cond: ts.Expression, whenTrue: boolean, fn: () => T): T {
        let c = strip(cond) as ts.Expression;
        let positive = whenTrue;
        let mode: 'truthy' | 'present' | 'defined' | 'nonNull' = 'truthy';
        while (typescript.isPrefixUnaryExpression(c) && c.operator === typescript.SyntaxKind.ExclamationToken) {
            positive = !positive;
            c = strip(c.operand) as ts.Expression;
        }

        // `x === undefined ? … : <x is set here>`, `x != null && <x is set here>` (numbers: `0` is set)
        const nullish = (e: ts.Expression) => e.kind === typescript.SyntaxKind.NullKeyword || (typescript.isIdentifier(e) && e.text === 'undefined');
        if (typescript.isBinaryExpression(c) && (nullish(strip(c.right) as ts.Expression) || nullish(strip(c.left) as ts.Expression))) {
            const op = c.operatorToken.kind;
            const eq = op === typescript.SyntaxKind.EqualsEqualsEqualsToken || op === typescript.SyntaxKind.EqualsEqualsToken;
            const ne = op === typescript.SyntaxKind.ExclamationEqualsEqualsToken || op === typescript.SyntaxKind.ExclamationEqualsToken;
            if (eq || ne) {
                mode = 'present';
                if (op === typescript.SyntaxKind.EqualsEqualsEqualsToken || op === typescript.SyntaxKind.ExclamationEqualsEqualsToken) {
                    const missing = strip(nullish(strip(c.right) as ts.Expression) ? c.right : c.left) as ts.Expression;
                    mode = missing.kind === typescript.SyntaxKind.NullKeyword ? 'nonNull' : 'defined';
                }
                positive = eq ? !positive : positive;
                c = strip(nullish(strip(c.right) as ts.Expression) ? c.left : c.right) as ts.Expression;
            }
        }

        // `a && b ? <both set here> : …`
        if (positive && typescript.isBinaryExpression(c) && c.operatorToken.kind === typescript.SyntaxKind.AmpersandAmpersandToken) {
            const {left, right} = c;
            return this.narrowing(left, true, () => this.narrowing(right, true, fn));
        }
        const key = positive ? this.narrowKey(c) : null;
        if (!key || this.narrowed.has(key)) {
            return fn();
        }
        this.narrowed.set(key, mode);
        try {
            return fn();
        } finally {
            this.narrowed.delete(key);
        }
    }

    /** Resolve a field path through object spreads, local bindings and helper arguments. */
    private descend(expr: ts.Expression | undefined, rest: string[], depth: number, seen: Set<ts.Node>): Value[] {
        const x = strip(expr) as ts.Expression;
        if (!x) {
            return [{k: 'absent'}];
        }
        if (!rest.length) {
            return this.resolve(x, depth + 1, seen);
        }
        if (typescript.isObjectLiteralExpression(x)) {
            for (let i = x.properties.length - 1; i >= 0; i--) {
                const p = x.properties[i];
                if (typescript.isSpreadAssignment(p)) {
                    const inner = this.descend(p.expression, rest, depth, seen);
                    if (!inner.every((v) => v.k === 'absent')) {
                        return inner;
                    }
                    continue;
                }
                if (propName(p.name) !== rest[0]) {
                    continue;
                }
                if (typescript.isShorthandPropertyAssignment(p)) {
                    return this.descend(p.name, rest.slice(1), depth, seen);
                }
                if (typescript.isPropertyAssignment(p)) {
                    return this.descend(p.initializer, rest.slice(1), depth, seen);
                }
                return [this.unres('object-member-kind', p)];
            }
            return [{k: 'absent', at: this.ix.where(x)}];
        }
        if (typescript.isCallExpression(x) && calleeName(x) === 'useMemo') {
            const f = strip(x.arguments[0]);
            if (f && isFunctionLike(f)) {
                return returnsOf(f).flatMap((r) => this.descend(r, rest, depth + 1, seen));
            }
        }
        if (typescript.isPropertyAccessExpression(x)) {
            const cc = this.sourceTrace.constantChain(x);
            if (cc && cc.init) {
                return this.descend(cc.init, [...cc.rest, ...rest], depth + 1, seen);
            }
        }
        if (typescript.isIdentifier(x)) {
            const d = this.symbolOf(x)?.valueDeclaration;
            if (d && typescript.isVariableDeclaration(d) && d.initializer) {
                return this.descend(d.initializer, rest, depth + 1, seen);
            }

            // a helper's parameter (`createSection({firstOption: {value: 'a'}})`): the path into each call's argument
            if (d && typescript.isParameter(d) && !this.props.propsPath(x)) {
                const listed = !seen.has(d) && this.sourceTrace.callbackItems(d);
                const items = listed && this.sourceTrace.narrowedItems(x, listed);
                if (items) {
                    return items.flatMap((item) => this.descendSource(item, rest, depth + 1, new Set([...seen, d])));
                }
                const fn = d.parent as FunctionLike;
                const cs = this.ix.calls.get(fn) ?? [];
                if (cs.length && !(fn.parent && typescript.isCallExpression(fn.parent)) && !seen.has(fn)) {
                    const idx = fn.parameters.indexOf(d);
                    const s2 = new Set([...seen, fn]);

                    // a call whose argument lacks the path can't render a testid read from it (`if (third) {... third.value}`)
                    const vals = cs.flatMap((c) => this.sourceTrace.atCall(c.arguments[idx] ? this.descend(c.arguments[idx], rest, depth + 1, s2) : [], fn, c));
                    const present = vals.filter((v) => v.k !== 'absent');
                    return present.length ? present : vals;
                }
            }
        }
        return [this.dataGap(x, rest)];
    }

    /** Resolve one source path while retaining the source’s mount and branch provenance. */
    private descendSource(src: Source, rest: string[], depth: number, seen: Set<ts.Node>): Value[] {
        const vals = 'marker' in src ? [this.dataGap(src.src, rest, true)] : this.descend(src.expr, rest, depth + 1, seen);
        return carryArms(src.via.length ? vals.map((v) => ({...v, via: [...src.via, ...(v.via ?? [])]})) : vals, src.arms);
    }

    // ---- resolve ------------------------------------------------------------------------

    private memoEnabled = false;
    private readonly rootMemo = new Map<ts.Expression, Value[]>();
    private rootMemoValues = 0;

    /** The scanner calls this once dynamic component usages have finished entering the index. */
    enableMemoization(): void {
        this.memoEnabled = true;
    }

    private reentries = new WeakMap<ts.Node, ts.Node>();

    /** A stand-in for "this component, entered a second time" in a resolution's `seen` set. */
    private reentryMarker(comp: ts.Node): ts.Node {
        let m = this.reentries.get(comp);
        if (!m) {
            m = {kind: comp.kind} as ts.Node;
            this.reentries.set(comp, m);
        }
        return m;
    }

    /** Resolve a testid with the stable surrounding runtime guards of its declaration. */
    resolveAtSite(e: ts.Expression, site: ts.Node): Value[] {
        return this.siteGuards.resolve(site, () => this.resolve(e));
    }

    /** Evaluate an expression to bounded values, memoizing only completed context-free roots. */
    resolve(e: ts.Expression | undefined, depth = 0, seen = new Set<ts.Node>(), env: Env | null = null): Value[] {
        const key = e && strip(e) as ts.Expression | undefined;
        const cacheable = Boolean(key) && this.memoEnabled && depth === 0 && !seen.size && !env && !this.narrowed.size;
        const memo = cacheable ? this.rootMemo.get(key!) : undefined;
        if (memo) {
            this.rootMemo.delete(key!);
            this.rootMemo.set(key!, memo);
            return memo;
        }
        const result = this.resolveUncached(e, depth, seen, env);
        if (cacheable && result.length <= 65536) {
            while (this.rootMemoValues + result.length > 65536 && this.rootMemo.size) {
                const oldest = this.rootMemo.keys().next().value!;
                this.rootMemoValues -= this.rootMemo.get(oldest)!.length;
                this.rootMemo.delete(oldest);
            }
            this.rootMemo.set(key!, result);
            this.rootMemoValues += result.length;
        }
        return result;
    }

    /** Dispatch expression syntax while preserving absence, typed gaps and compatible branch alternatives. */
    private resolveUncached(e: ts.Expression | undefined, depth: number, seen: Set<ts.Node>, env: Env | null): Value[] {
        const x = strip(e) as ts.Expression;
        if (!x) {
            return [{k: 'absent'}];
        }

        // inside `testId ? \`${testId}--button\` : …`, testId is known to be set
        const nk = this.narrowed.size ? this.narrowKey(x) : null;
        if (nk && this.narrowed.has(nk)) {
            const mode = this.narrowed.get(nk)!;
            this.narrowed.delete(nk);
            try {
                return this.resolve(x, depth, seen, env).filter((v) => {
                    if (mode === 'truthy') {
                        return !isFalsy(v);
                    }
                    if (v.k !== 'absent') {
                        return true;
                    }
                    return (mode === 'defined' && Boolean(v.nullValue)) || (mode === 'nonNull' && !v.nullValue);
                });
            } finally {
                this.narrowed.set(nk, mode);
            }
        }
        if (this.sourceTrace.declaredKeyProp(x)) {
            const value = this.gapFor(x);
            const type = this.checker.getTypeAtLocation(x);
            const members = type.isUnion() ? type.types : [type];
            const optional = members.some((member) => member.flags & (typescript.TypeFlags.Undefined | typescript.TypeFlags.Null));
            return optional ? [value, {k: 'absent', at: this.ix.where(x)}] : [value];
        }
        if (typescript.isStringLiteral(x) || typescript.isNoSubstitutionTemplateLiteral(x)) {
            let parent: ts.Node | undefined = x.parent;
            let inArray = false;
            while (parent && !isFunctionLike(parent)) {
                inArray ||= typescript.isArrayLiteralExpression(parent);
                if (typescript.isVariableDeclaration(parent)) {
                    return [{...lit(x.text), ...(inArray && typescript.isIdentifier(parent.name) ? {setSource: parent.name.text} : {})}];
                }
                parent = parent.parent;
            }
            return [lit(x.text)];
        }
        if (depth > MAX_RESOLVE_DEPTH) {
            return [{...this.gapFor(x), recursive: true} as Value];
        }
        if (x.kind === typescript.SyntaxKind.UndefinedKeyword || x.kind === typescript.SyntaxKind.NullKeyword || (typescript.isIdentifier(x) && x.text === 'undefined')) {
            return [{k: 'absent', at: this.ix.where(x), ...(x.kind === typescript.SyntaxKind.NullKeyword ? {nullValue: true as const} : {})}];
        }
        if (typescript.isNumericLiteral(x)) {
            return [lit(String(Number(x.text)), undefined, 'number')];
        }
        if (typescript.isPrefixUnaryExpression(x) && (x.operator === typescript.SyntaxKind.MinusToken || x.operator === typescript.SyntaxKind.PlusToken) && typescript.isNumericLiteral(x.operand)) {
            return [lit(String((x.operator === typescript.SyntaxKind.MinusToken ? -1 : 1) * Number(x.operand.text)), undefined, 'number')];
        }
        if (typescript.isTemplateExpression(x)) {
            let acc: Value[] = [lit(x.head.text)];
            for (const span of x.templateSpans) {
                acc = concat(acc, this.resolveOrGap(span.expression, depth, seen, env));
                acc = concat(acc, [lit(span.literal.text)]);
            }
            return this.locateTruncation(acc, x);
        }
        if (typescript.isBinaryExpression(x)) {
            const op = x.operatorToken.kind;
            if (op === typescript.SyntaxKind.PlusToken) {
                const left = this.resolve(x.left, depth + 1, seen, env);
                const right = this.resolve(x.right, depth + 1, seen, env);
                if (left.every((value) => value.k === 'lit') && right.every((value) => value.k === 'lit')) {
                    return this.locateTruncation(concat(left, right, true), x);
                }
                return this.locateTruncation(concat(this.resolveOrGap(x.left, depth, seen, env), this.resolveOrGap(x.right, depth, seen, env)), x);
            }
            if (op === typescript.SyntaxKind.BarBarToken || op === typescript.SyntaxKind.QuestionQuestionToken) {
                let left = this.resolve(x.left, depth + 1, seen, env);
                const right = this.resolve(x.right, depth + 1, seen, env);

                // `a || b`: where a is an empty string, b is used instead
                if (op === typescript.SyntaxKind.BarBarToken && left.some((v) => withoutEmptyMember(v) !== v)) {
                    left = left.map(withoutEmptyMember);
                    return [...left.filter((v) => !isFalsy(v)), ...right];
                }

                if (op === typescript.SyntaxKind.QuestionQuestionToken) {
                    const nullish = left.map((value): Value => (value.k === 'absent' || value.k === 'lit' || value.k === 'pat' ? {...lit(String(value.k === 'absent'), value.via, 'boolean'), arms: value.arms} : value));
                    return [...left.filter((value) => value.k !== 'absent'), ...distribute(right, {vals: nullish, negate: false}, true)];
                }

                // Per instance, || takes the fallback only where the left side can be falsy.
                const cond = {vals: left, negate: false};
                return [...left.filter((v) => !isFalsy(v)), ...distribute(right, cond, false)];
            }
            if (op === typescript.SyntaxKind.AmpersandAmpersandToken) {
                const cond = this.condition(x.left, depth, seen, env);
                const right = this.narrowing(x.left, true, () => this.resolve(x.right, depth + 1, seen, env));
                const left = this.resolve(x.left, depth + 1, seen, env);
                return cond ? [...distribute(right, cond, true), ...distribute(left, cond, false)] : [...right, ...left];
            }
        }
        if (typescript.isConditionalExpression(x)) {
            const cond = this.condition(x.condition, depth, seen, env);
            const arm = this.armKey(x.condition);
            const t = withArm(this.narrowing(x.condition, true, () => this.resolve(x.whenTrue, depth + 1, seen, env)), arm, true);
            const f = withArm(this.narrowing(x.condition, false, () => this.resolve(x.whenFalse, depth + 1, seen, env)), arm, false);
            const test = strip(x.condition) as ts.Expression;
            if (!cond && typescript.isBinaryExpression(test)) {
                // `a && b ? t : f`: t can't be taken where `a` or `b` is false; `a || b ? t : f`: f can't be taken where either is true
                const left = this.condition(test.left, depth, seen, env);
                const right = this.condition(test.right, depth, seen, env);
                const sides = [left, right].filter((c): c is NonNullable<typeof left> => Boolean(c));
                if (sides.length && test.operatorToken.kind === typescript.SyntaxKind.AmpersandAmpersandToken) {
                    // f is taken where either side can be false
                    const fs = left && right ? union(distribute(f, left, false), distribute(f, right, false)) : perInstance(f, sides[0]);
                    return [...sides.reduce((vs, c) => distribute(vs, c, true), t), ...fs];
                }
                if (sides.length && test.operatorToken.kind === typescript.SyntaxKind.BarBarToken) {
                    const ts2 = left && right ? union(distribute(t, left, true), distribute(t, right, true)) : perInstance(t, sides[0]);
                    return [...ts2, ...sides.reduce((vs, c) => distribute(vs, c, false), f)];
                }
            }
            if (!cond) {
                return [...t, ...f];
            }

            // per instance, an arm whose condition is known to be false there can't be taken
            return [...distribute(t, cond, true), ...distribute(f, cond, false)];
        }

        const pp = this.props.propsPath(x);
        if (pp && pp.comp) {
            // A component that renders itself (a post preview inside a post) is unrolled once: the inner instance's
            // prop resolves through the outer instance's real callers, and only a second re-entry is a gap. The
            // gap's `{key}` template is then dropped where the unrolled one accounts for it (scan.ts).
            const again = this.reentryMarker(pp.comp);
            if (seen.has(pp.comp) && seen.has(again)) {
                return [{...this.gapFor(x), recursive: true} as Value];
            }
            if (!pp.path.length) {
                return [this.unres('whole-props-object', x)];
            }
            const r = this.props.resolveProps(pp.comp, pp.path, depth + 1, new Set([...seen, seen.has(pp.comp) ? again : pp.comp]));
            return r.flatMap((v) => {
                if (v.k === 'unres' && v.why === 'component-has-no-static-usage') {
                    return this.literalsFromType(x)?.map((value) => ({...value, ...(v.via ? {via: v.via} : {}), ...(v.arms ? {arms: v.arms} : {})})) ?? [{...this.gapFor(x), libraryRendered: true, via: v.via} as Value];
                }
                return v.k === 'unres' && v.why === 'from-connect' ? {...this.gapFor(x), via: v.via} as Value : this.typedHere(v, x);
            });
        }

        if (typescript.isIdentifier(x)) {
            const r = this.resolveIdentifier(x, depth, seen, env);
            if (r) {
                return r;
            }
        }
        if (typescript.isPropertyAccessExpression(x) || typescript.isElementAccessExpression(x)) {
            const writes = seen.has(x) ? [] : this.importedWrites.alternatives(x);
            if (writes.length) {
                const s2 = new Set([...seen, x]);
                return union(this.resolve(x, depth + 1, s2, env), writes.flatMap((write): Value[] => {
                    if (write.absent) {
                        return [{k: 'absent', at: this.ix.where(x)}];
                    }
                    return write.expression ? this.resolve(write.expression, depth + 1, s2, env) : [this.unres('mutable-import', x)];
                }));
            }
        }
        if (typescript.isPropertyAccessExpression(x)) {
            const cc = this.sourceTrace.constantChain(x);
            if (cc && cc.init) {
                return this.descend(cc.init, cc.rest, depth + 1, seen).map((value) => this.typedHere(value, x));
            }
            if (cc && cc.items) {
                return cc.items.flatMap((it) => this.descendSource(it, cc.rest, depth, seen)).map((value) => this.typedHere(value, x));
            }
        }
        if (typescript.isCallExpression(x)) {
            const r = this.resolveCall(x, depth, seen, env);
            if (!r.every((v) => v.k === 'computed')) {
                return r;
            }
            return this.literalsFromType(x) ?? r;
        }

        // `true` / `false` (a prop passed `={true}`, a default `= false`), as a valueless attribute is 'true'
        if (x.kind === typescript.SyntaxKind.TrueKeyword || x.kind === typescript.SyntaxKind.FalseKeyword) {
            return [lit(x.kind === typescript.SyntaxKind.TrueKeyword ? 'true' : 'false', undefined, 'boolean')];
        }

        // nothing more precise: the declared type's literals (as const members, literal unions)
        return this.literalsFromType(x) ?? [this.unres('runtime-value', x)];
    }

    /** Where the expression whose values were cut at a cap is (`concat` doesn't know), counted once per place. */
    private locateTruncation(vals: Value[], x: ts.Expression): Value[] {
        if (!vals.some((v) => v.k === 'unres' && v.why === TOO_MANY_VALUES && !v.at)) {
            return vals;
        }
        const at = this.ix.where(x);
        this.truncatedAt.add(at);
        return vals.map((v) => (v.k === 'unres' && v.why === TOO_MANY_VALUES && !v.at ? truncated(at) : v));
    }

    /** Expressions whose values were cut at a cap. */
    readonly truncatedAt = new Set<Loc>();

    /**
     * The key of an `Object.entries(x)` / `Object.keys(x)` element, by declaration: `for (const [key] of Object.entries(x))`,
     * `for (const key of Object.keys(x))`, and the same as the first parameter of an iteration callback
     * (`Object.entries(x).map(([key]) => …)`). A key gap whose origin is the keys of x: a set when x's type has a fixed
     * set of keys and no index signature, otherwise an open string that names `x` (not the variable it was bound to).
     */
    private collectionKey(d: ts.Declaration): Value | null {
        let holder: ts.Node | undefined;
        let method: 'entries' | 'keys';
        if (typescript.isBindingElement(d) && typescript.isArrayBindingPattern(d.parent) && d.parent.elements.indexOf(d) === 0 && !d.dotDotDotToken) {
            holder = d.parent.parent;
            method = 'entries';
        } else if ((typescript.isVariableDeclaration(d) || typescript.isParameter(d)) && typescript.isIdentifier(d.name)) {
            holder = d;
            method = 'keys';
        } else {
            return null;
        }
        let iterated: ts.Expression | undefined;
        if (typescript.isVariableDeclaration(holder) && typescript.isVariableDeclarationList(holder.parent) && typescript.isForOfStatement(holder.parent.parent)) {
            iterated = holder.parent.parent.expression;
        } else if (typescript.isParameter(holder) && holder.parent.parameters[0] === holder && holder.parent.parent && typescript.isCallExpression(holder.parent.parent)) {
            const call = holder.parent.parent;
            const callee = strip(call.expression);
            if (call.arguments[0] === holder.parent && typescript.isPropertyAccessExpression(callee) && LIST_METHODS.includes(callee.name.text)) {
                iterated = callee.expression;
            }
        }
        const source = iterated && strip(iterated);

        // an element of an array field (`for (const p of group.permissions)`): the field's keyFields entry, if it has one
        if (method === 'keys' && source && typescript.isPropertyAccessExpression(source) && this.checker.isArrayLikeType(this.checker.getTypeAtLocation(source))) {
            const owner = this.checker.getNonNullableType(this.checker.getTypeAtLocation(source.expression));
            const entry = this.keys.keyFieldEntry(owner, source.name.text);
            if (!entry) {
                return null;
            }
            const element: Gap = {kind: 'id', type: 'string', expr: `${shortText(source)}[]`, entity: entry.entity, field: entry.field, value: entry.value ?? entry.field, freeForm: Boolean(entry.freeForm), fieldEntry: entry};
            return {k: 'pat', parts: [{gap: element}]};
        }
        if (!source || !typescript.isCallExpression(source) || !source.arguments[0]) {
            return null;
        }
        const object = strip(source.expression);
        if (!typescript.isPropertyAccessExpression(object) || !typescript.isIdentifier(object.expression) || object.expression.text !== 'Object' || object.name.text !== method || !this.isGlobalObject(object.expression)) {
            return null;
        }
        const target = source.arguments[0];
        const info: Gap = {kind: 'string', type: 'string', expr: `Object.${method}(${shortText(target)})[]${method === 'entries' ? '.key' : ''}`};

        const origin = this.constOrigin(target);
        const type = this.checker.getNonNullableType(this.checker.getTypeAtLocation(origin));
        const keys = type.getProperties().map((property) => property.getName());
        if (keys.length && !this.checker.getIndexInfosOfType(type).length) {
            info.kind = 'set';
            info.values = [...new Set(keys)].sort();
            info.type = info.values.map((key) => JSON.stringify(key)).join(' | ');
            return {k: 'pat', parts: [{gap: info}]};
        }
        this.recordKeys(info, target);
        return {k: 'pat', parts: [{gap: info}]};
    }

    /** A local's keys are the keys of what it was built from: the expression const initializers lead to. */
    private constOrigin(target: ts.Expression): ts.Expression {
        let origin = strip(target) as ts.Expression;
        for (let hop = 0; hop < MAX_RESOLVE_DEPTH && typescript.isIdentifier(origin); hop++) {
            const declaration = this.symbolOf(origin)?.valueDeclaration;
            if (!declaration || !typescript.isVariableDeclaration(declaration) || !declaration.initializer || isLet(declaration)) {
                break;
            }
            origin = strip(declaration.initializer) as ts.Expression;
        }
        return origin;
    }

    /**
     * Keys an open record's keys (`Object.keys(target)`, `Object.entries(target)`) by a keyFields entry: a record field
     * an entry declares with 'keys: true' (free-form, named by 'value'), also as a helper's parameter every call passes
     * the same such field (`this.renderRootMenu(this.props.adminDefinition)`), or the field a record is grouped by
     * (`byArea[finding.area] = []`).
     */
    private recordKeys(info: Gap, target: ts.Expression): void {
        const origin = this.constOrigin(target);
        const recordEntry = (field: ts.Expression) => {
            const e = strip(field) as ts.Expression;
            if (!typescript.isPropertyAccessExpression(e)) {
                return undefined;
            }
            return this.keys.keyFieldEntry(this.checker.getNonNullableType(this.checker.getTypeAtLocation(e.expression)), e.name.text, {keys: true});
        };
        let entry = recordEntry(origin);
        const parameter = typescript.isIdentifier(origin) ? this.symbolOf(origin)?.valueDeclaration : undefined;
        if (!entry && parameter && typescript.isParameter(parameter)) {
            const fn = parameter.parent as FunctionLike;
            const index = fn.parameters.indexOf(parameter);
            const passed = (this.ix.calls.get(fn) ?? []).map((call) => (call.arguments[index] ? recordEntry(call.arguments[index]) : undefined));
            entry = passed.length && passed.every((item) => item && item === passed[0]) ? passed[0] : undefined;
        }
        entry ??= this.groupedKeyEntry(target, 0, new Set());
        if (entry?.value) {
            info.kind = 'id';
            info.entity = entry.entity;
            info.field = entry.field;
            info.value = entry.value;
            info.freeForm = true;
            info.fieldEntry = entry;
        }
    }

    /**
     * The keyFields entry a record is grouped by: the record a local is built as (`const byArea = {}` written as
     * `byArea[finding.area] = []`, read as `byArea[finding.area].push(…)`), reached through the parameters (each call's
     * argument), calls (the function's returns) and const initializers it flows through. Every element access must be
     * keyed by a field of the same entry, and every path must agree; otherwise there is none.
     */
    private groupedKeyEntry(expr: ts.Expression, depth: number, seen: Set<ts.Node>, builder?: FunctionLike): KeyFieldAllow | undefined {
        const e = strip(expr) as ts.Expression;
        if (depth > MAX_RESOLVE_DEPTH) {
            return undefined;
        }
        const agree = (entries: Array<KeyFieldAllow | undefined>) => (entries.length && entries.every((item) => item && item === entries[0]) ? entries[0] : undefined);
        if (typescript.isCallExpression(e)) {
            const fn = this.ix.unwrapExpr(e.expression);
            if (!fn || !isFunctionLike(fn) || this.ix.isLibraryNode(fn) || seen.has(fn)) {
                return undefined;
            }
            return agree(returnsOf(fn).map((returned) => this.groupedKeyEntry(returned, depth + 1, new Set([...seen, fn]), fn)));
        }
        if (!typescript.isIdentifier(e)) {
            return undefined;
        }
        const symbol = this.symbolOf(e);
        const declaration = symbol?.valueDeclaration;
        if (!symbol || !declaration || seen.has(declaration)) {
            return undefined;
        }
        const next = new Set([...seen, declaration]);

        // a name the record passes through (the caller's `const byArea = group(…)`, a helper's `findingsByArea`) must only
        // read it: a write or an escape there could add keys the grouping doesn't name
        if ((typescript.isParameter(declaration) || (typescript.isVariableDeclaration(declaration) && declaration.initializer && !(typescript.isObjectLiteralExpression(strip(declaration.initializer) as ts.Expression) && !(strip(declaration.initializer) as ts.ObjectLiteralExpression).properties.length))) && !this.onlyReads(symbol, declaration, depth)) {
            return undefined;
        }
        if (typescript.isParameter(declaration)) {
            const fn = declaration.parent as FunctionLike;
            const index = fn.parameters.indexOf(declaration);
            return agree((this.ix.calls.get(fn) ?? []).map((call) => (call.arguments[index] ? this.groupedKeyEntry(call.arguments[index], depth + 1, next) : undefined)));
        }
        if (!typescript.isVariableDeclaration(declaration) || !declaration.initializer) {
            return undefined;
        }
        const initializer = strip(declaration.initializer) as ts.Expression;
        if (!typescript.isObjectLiteralExpression(initializer) || initializer.properties.length) {
            return isLet(declaration) ? undefined : this.groupedKeyEntry(initializer, depth + 1, next, builder);
        }

        // an empty object filled by key: the keys of every element access of it in its scope. Only a record that never
        // escapes is proven: every other reference (`const alias = result`, `fill(result)`, `Object.assign(result, …)`)
        // could add keys this walk doesn't see, so it proves nothing
        // and a record made fresh for each call: declared directly in the builder whose return it is (not in a module, nor
        // in an outer factory's closure that every call shares), or, read where it is built, inside a function
        const declaredIn = typescript.findAncestor(declaration.parent, (node) => isFunctionLike(node));
        if (builder ? declaredIn !== builder : !declaredIn) {
            return undefined;
        }
        const scope = typescript.findAncestor(declaration, (node) => isFunctionLike(node) || typescript.isSourceFile(node)) ?? declaration.getSourceFile();
        const keys: Array<KeyFieldAllow | undefined> = [];
        let escapes = false;
        const visit = (node: ts.Node) => {
            if (escapes) {
                return;
            }
            if (typescript.isIdentifier(node) && node !== declaration.name && this.symbolOf(node) === symbol) {
                const parent = node.parent;
                if (typescript.isElementAccessExpression(parent) && parent.expression === node) {
                    const key = strip(parent.argumentExpression) as ts.Expression;
                    keys.push(typescript.isPropertyAccessExpression(key) ? this.keys.keyFieldEntry(this.checker.getNonNullableType(this.checker.getTypeAtLocation(key.expression)), key.name.text, {withValue: true}) : undefined);
                } else if (!(typescript.isReturnStatement(parent) && parent.expression === node)) {
                    escapes = true;
                }
            }
            typescript.forEachChild(node, visit);
        };
        visit(scope);
        return escapes ? undefined : agree(keys);
    }

    /**
     * Whether every reference to a record in its declaring scope only reads it: an element read (`byArea[area]`,
     * `byArea[k].push(…)` changes a value, not the keys), `Object.keys/entries/values(byArea)`, a pass to an in-repo
     * function whose parameter only reads it in turn, or the binding a for-of reads. An element write, an alias, a
     * return or any other use does not.
     */
    private onlyReads(symbol: ts.Symbol, declaration: ts.Declaration, depth: number): boolean {
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
            if (typescript.isIdentifier(node) && node !== name && this.symbolOf(node) === symbol) {
                reads = this.readUse(node, depth);
            }
            typescript.forEachChild(node, visit);
        };
        visit(scope);
        return reads;
    }

    /** Check whether a record reference only reads its keys or passes it to another read-only helper. */
    private readUse(reference: ts.Identifier, depth: number): boolean {
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
        if (typescript.isPropertyAccessExpression(callee) && typescript.isIdentifier(callee.expression) && callee.expression.text === 'Object' && this.isGlobalObject(callee.expression)) {
            return ['keys', 'entries', 'values'].includes(callee.name.text);
        }
        const fn = this.ix.unwrapExpr(parent.expression);
        const index = parent.arguments.indexOf(reference);
        const parameter = fn && isFunctionLike(fn) && !this.ix.isLibraryNode(fn) ? fn.parameters[index] : undefined;
        const parameterSymbol = parameter && typescript.isIdentifier(parameter.name) ? this.symbolOf(parameter.name) : undefined;
        return Boolean(parameter && parameterSymbol && this.onlyReads(parameterSymbol, parameter, depth + 1));
    }

    /** `Object` as the standard library declares it, not a local or imported binding that happens to share the name. */
    private isGlobalObject(identifier: ts.Identifier): boolean {
        const declarations = this.checker.getSymbolAtLocation(identifier)?.declarations ?? [];
        return declarations.length > 0 && declarations.every((declaration) => this.ix.program.isSourceFileDefaultLibrary(declaration.getSourceFile()));
    }

    /** Conditions enclosing a write, with the branch in which it executes. */
    private assignmentGuards(rhs: ts.Expression): Array<{expression: ts.Expression; when: boolean; nullish?: true}> {
        const guards: Array<{expression: ts.Expression; when: boolean; nullish?: true}> = [];
        for (let child: ts.Node = rhs, parent = rhs.parent; parent && !isFunctionLike(parent); child = parent, parent = parent.parent) {
            if (typescript.isIfStatement(parent) && child !== parent.expression) {
                guards.push({expression: parent.expression, when: child === parent.thenStatement});
            } else if (typescript.isConditionalExpression(parent) && child !== parent.condition) {
                guards.push({expression: parent.condition, when: child === parent.whenTrue});
            } else if (typescript.isBinaryExpression(parent) && child === parent.right) {
                if (parent.operatorToken.kind === typescript.SyntaxKind.QuestionQuestionToken) {
                    guards.push({expression: parent.left, when: true, nullish: true});
                } else if (parent.operatorToken.kind === typescript.SyntaxKind.AmpersandAmpersandToken || parent.operatorToken.kind === typescript.SyntaxKind.BarBarToken) {
                    guards.push({expression: parent.left, when: parent.operatorToken.kind === typescript.SyntaxKind.AmpersandAmpersandToken});
                }
            }
        }
        return guards;
    }

    /** Only a preceding write on the same ordinary execution path can remove an unassigned alternative. */
    private writeCanEstablishAssignment(rhs: ts.Expression, reference: ts.Identifier, declaration: ts.VariableDeclaration): boolean {
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

    /** Trace a named value through its declaration, assignments, arguments and collection bindings. */
    private resolveIdentifier(x: ts.Identifier, depth: number, seen: Set<ts.Node>, env: Env | null): Value[] | null {
        const sym = this.symbolOf(x);
        let d = sym?.valueDeclaration;
        if (sym && (sym.flags & typescript.SymbolFlags.Alias)) {
            d = this.checker.getAliasedSymbol(sym).valueDeclaration;
        }
        if (!d) {
            return null;
        }
        const collectionKey = this.collectionKey(d);
        if (collectionKey) {
            return [collectionKey];
        }
        if (typescript.isVariableDeclaration(d) && (d.initializer || isLet(d))) {
            if (seen.has(d)) {
                return [{...this.gapFor(x), recursive: true} as Value];
            }

            // let x = ...; if (...) x = ...  (or `let x: T;` assigned later)
            const s2 = isLet(d) ? new Set([...seen, d]) : seen;
            const initial = d.initializer ? this.resolve(d.initializer, depth + 1, s2, env) : [{k: 'absent', at: this.ix.where(d)} as Value];
            const vals: Value[] = initial.filter((value) => value.k !== 'absent');
            let unassigned: Value[] = initial.filter((value) => value.k === 'absent');
            for (const rhs of assignmentsOf(d, this.checker.getSymbolAtLocation(d.name) ?? sym!, this.checker)) {
                let assigned = this.resolve(rhs, depth + 1, s2, env);
                for (const guard of this.assignmentGuards(rhs)) {
                    const arm = guard.nullish ? {key: `nullish:${this.ix.where(guard.expression)}`, negate: false} : this.armKey(guard.expression) ?? {key: `guard:${this.ix.where(guard.expression)}`, negate: false};
                    const condition = guard.nullish ? {
                        vals: this.resolve(guard.expression, depth + 1, s2, env).map((value): Value => {
                            if (value.k === 'absent' || value.k === 'lit' || isTruthy(value)) {
                                return {...lit(String(value.k === 'absent'), value.via, 'boolean'), arms: value.arms};
                            }
                            return value;
                        }),
                        negate: false,
                    } : this.condition(guard.expression, depth + 1, s2, env, true);
                    assigned = withArm(assigned, arm, guard.when);
                    if (condition) {
                        assigned = distribute(assigned, condition, guard.when);
                    }
                }
                if (this.writeCanEstablishAssignment(rhs, x, d)) {
                    unassigned = [];
                }
                vals.push(...assigned);
            }
            const declared = this.literalsFromType(x);
            if (declared && vals.some((value) => value.k !== 'lit' && value.k !== 'absent')) {
                return [...perInstance(declared, {vals}), ...unassigned];
            }
            return [...vals, ...unassigned];
        }
        if (typescript.isParameter(d) && env && sym && env.has(sym)) {
            const b = env.get(sym)!;
            return this.resolve(b.expr, depth + 1, seen, b.env);
        }
        if (typescript.isParameter(d)) {
            const fn = d.parent as FunctionLike;
            const idx = fn.parameters.indexOf(d);
            const listed = this.sourceTrace.callbackItems(d);
            const items = listed && this.sourceTrace.narrowedItems(x, listed);
            if (items) {
                return items.flatMap((it) => this.descendSource(it, [], depth, seen));
            }
            if (fn.parent && typescript.isCallExpression(fn.parent)) {
                return [this.gapFor(x)];
            }
            if (idx === 1 && this.sourceTrace.listsPassedTo(fn).some((list) => this.checker.isArrayLikeType(this.checker.getTypeAtLocation(list)))) {
                return [this.gapFor(x)];
            }
            const cs = this.ix.calls.get(fn) ?? [];
            if (!cs.length) {
                // `const render = (x) => …` passed by name, `list.map(render)`: the list's elements, or key data
                const lists = idx === 0 ? this.sourceTrace.listsPassedTo(fn) : [];
                if (lists.length) {
                    const items = lists.map((l) => this.sourceTrace.arrayElements(l));
                    return items.every(Boolean) ? items.flatMap((it) => it!).flatMap((it) => this.descendSource(it, [], depth, seen)) : [this.gapFor(x)];
                }
                return [this.unres('param-no-calls', x)];
            }
            const out: Value[] = [];
            for (const c of cs) {
                const arg = c.arguments[idx];
                const value = arg ?? d.initializer;

                // Passing an absent argument does not interpolate it: a helper can guard it before building a testid.
                out.push(...this.sourceTrace.atCall(value ? this.resolveOrGap(value, depth + 1, seen, env, true) : [{k: 'absent'} as Value], fn, c));
            }
            return out;
        }
        if (typescript.isBindingElement(d)) {
            const loop = this.sourceTrace.forOfBinding(d);
            if (loop) {
                return loop.items.flatMap((item) => this.descendSource(item, loop.path, depth, seen));
            }
            const bp = this.props.bindingPath(d);
            if (bp && bp.root.kind === 'expr') {
                return this.descend(bp.root.expr, bp.path, depth + 1, seen);
            }

            // `options.map(({option}) => ...)` over a fixed list: the field of each item
            if (bp && bp.root.kind === 'param' && !this.props.isComponentFn(bp.root.fn)) {
                const items = this.sourceTrace.callbackItems(bp.root.fn.parameters[0]);
                if (items) {
                    return items.flatMap((it) => this.descendSource(it, bp.path, depth, seen));
                }
            }
        }
        return null;
    }

    /** Evaluate supported local helper returns with arguments bound to this call. */
    private resolveCall(x: ts.CallExpression, depth: number, seen: Set<ts.Node>, env: Env | null): Value[] {
        if (calleeName(x) === 'useMemo') {
            const f = strip(x.arguments[0]);
            if (f && isFunctionLike(f)) {
                return returnsOf(f).flatMap((r) => this.resolve(r, depth + 1, seen, env));
            }
        }

        // small local helpers: their return expressions with parameters bound to this call's arguments
        const callee = strip(x.expression);
        const sym = (typescript.isIdentifier(callee) || typescript.isPropertyAccessExpression(callee)) ? this.checker.getSymbolAtLocation(callee) : undefined;
        const fn = sym && this.ix.resolveSymbolToNode(sym);
        if (fn && isFunctionLike(fn) && fn.body && !seen.has(fn)) {
            const benv: Env = new Map(env ?? []);
            fn.parameters.forEach((p, i) => {
                const ps = this.checker.getSymbolAtLocation(p.name);
                if (ps && x.arguments[i]) {
                    benv.set(ps, {expr: x.arguments[i], env});
                }
            });
            const rets = returnsOf(fn);
            if (rets.length && rets.length <= MAX_HELPER_RETURNS) {
                return rets.flatMap((r) => this.resolve(r, depth + 1, new Set([...seen, fn]), benv));
            }
        }
        return [this.alwaysTruthy(x) ? {k: 'computed', at: this.ix.where(x), truthy: true} : {k: 'computed', at: this.ix.where(x)}];
    }

    private readonly conditionMemo = new Map<string, {vals: Value[]; negate: boolean} | null>();
    private readonly conditionNodeIds = new WeakMap<ts.Node, number>();
    private conditionNextId = 0;

    /** Guard results depend on the complete recursion/narrowing context; cache only unbound environments. */
    private condition(c: ts.Expression, depth: number, seen: Set<ts.Node>, env: Env | null, comparisons = false): {vals: Value[]; negate: boolean} | null {
        if (!this.memoEnabled || env || !comparisons) {
            return this.conditionUncached(c, depth, seen, env, comparisons);
        }
        const ids = [...seen].map((node) => {
            let id = this.conditionNodeIds.get(node);
            if (id === undefined) {
                id = this.conditionNextId++;
                this.conditionNodeIds.set(node, id);
            }
            return id;
        }).sort((a, b) => a - b);
        let nodeId = this.conditionNodeIds.get(c);
        if (nodeId === undefined) {
            nodeId = this.conditionNextId++;
            this.conditionNodeIds.set(c, nodeId);
        }
        const key = JSON.stringify([nodeId, depth, ids, [...this.narrowed].sort()]);
        if (this.conditionMemo.has(key)) {
            const result = this.conditionMemo.get(key)!;
            this.conditionMemo.delete(key);
            this.conditionMemo.set(key, result);
            return result;
        }
        const result = this.conditionUncached(c, depth, seen, env, comparisons);

        // Evict cold optimization entries, never analysis states: every miss still computes the full result.
        if (this.conditionMemo.size >= 2048) {
            this.conditionMemo.delete(this.conditionMemo.keys().next().value!);
        }
        this.conditionMemo.set(key, result);
        return result;
    }

    /** Values of a simple condition (a prop, a variable, or its negation), or null when the condition is computed. */
    private conditionUncached(c: ts.Expression, depth: number, seen: Set<ts.Node>, env: Env | null, comparisons = false): {vals: Value[]; negate: boolean} | null {
        let e = strip(c) as ts.Expression;
        let negate = false;
        while (typescript.isPrefixUnaryExpression(e) && e.operator === typescript.SyntaxKind.ExclamationToken) {
            negate = !negate;
            e = strip(e.operand) as ts.Expression;
        }
        if (comparisons && typescript.isIdentifier(e)) {
            const declaration = this.symbolOf(e)?.valueDeclaration;

            // A const stores the initializer result: later calls cannot change that captured boolean.
            if (declaration && typescript.isVariableDeclaration(declaration) && declaration.initializer && !seen.has(declaration) && (declaration.parent.flags & typescript.NodeFlags.Const) && this.siteGuards.stable(declaration.initializer, declaration.initializer)) {
                const inner = this.condition(declaration.initializer, depth + 1, new Set([...seen, declaration]), env, true);
                if (inner) {
                    return {vals: inner.vals, negate: inner.negate !== negate};
                }
            }
        }
        if (comparisons && typescript.isBinaryExpression(e)) {
            const op = e.operatorToken.kind;
            const logical = op === typescript.SyntaxKind.AmpersandAmpersandToken || op === typescript.SyntaxKind.BarBarToken;
            const equality = op === typescript.SyntaxKind.EqualsEqualsEqualsToken || op === typescript.SyntaxKind.ExclamationEqualsEqualsToken;
            if (!logical && !equality) {
                return null;
            }
            const left = logical ? this.condition(e.left, depth + 1, seen, env, true) : {vals: this.resolve(e.left, depth + 1, seen, env), negate: false};
            const right = logical ? this.condition(e.right, depth + 1, seen, env, true) : {vals: this.resolve(e.right, depth + 1, seen, env), negate: false};
            if (!left || !right) {
                return null;
            }
            const primitive = (expr: ts.Expression) => {
                const type = this.checker.getTypeAtLocation(expr);
                const parts = type.isUnion() ? type.types : [type];
                return [typescript.TypeFlags.StringLike, typescript.TypeFlags.NumberLike, typescript.TypeFlags.BooleanLike, typescript.TypeFlags.BigIntLike].find((flag) => parts.every((part) => Boolean(part.flags & flag)));
            };
            const leftKind = primitive(e.left);
            const rightKind = primitive(e.right);
            function boolean(value: Value, invert: boolean): boolean | null {
                if (isFalsy(value)) {
                    return invert;
                }
                return isTruthy(value) ? !invert : null;
            }
            const leftValues = distinctValues(left.vals);
            const rightValues = distinctValues(right.vals);
            const leftNegate = left.negate;
            const rightNegate = right.negate;
            function* combinations(resolver: Resolver): Generator<Value> {
                for (const a of leftValues) {
                    for (const b of rightValues) {
                        const arms = mergeArms(a.arms, b.arms);
                        if (arms === false || (a.via && b.via && !prefixCompatible(a.via, b.via))) {
                            continue;
                        }
                        let answer: boolean | null = null;
                        if (logical) {
                            const l = boolean(a, leftNegate);
                            const r = boolean(b, rightNegate);
                            if (op === typescript.SyntaxKind.AmpersandAmpersandToken) {
                                if (l === false || r === false) {
                                    answer = false;
                                } else if (l === true && r === true) {
                                    answer = true;
                                }
                            } else if (l === true || r === true) {
                                answer = true;
                            } else if (l === false && r === false) {
                                answer = false;
                            }
                        } else {
                            if (a.k === 'lit' && b.k === 'lit' && leftKind && rightKind) {
                                answer = (a.primitive ?? 'string') === (b.primitive ?? 'string') && a.s === b.s;
                            } else if (a.k === 'absent' && b.k === 'absent') {
                                answer = Boolean(a.nullValue) === Boolean(b.nullValue);
                            } else if ((a.k === 'absent' && b.k === 'lit') || (a.k === 'lit' && b.k === 'absent')) {
                                answer = false;
                            }
                            if (answer !== null && op === typescript.SyntaxKind.ExclamationEqualsEqualsToken) {
                                answer = !answer;
                            }
                        }
                        const via = (a.via?.length ?? 0) >= (b.via?.length ?? 0) ? a.via : b.via;
                        yield {...(answer === null ? resolver.unres('runtime-condition', e) : lit(String(answer), undefined, 'boolean')), ...(via ? {via} : {}), ...(arms ? {arms} : {})};
                    }
                }
            }
            const vals = conditionContexts(distinctValues(combinations(this)));
            return {vals, negate};
        }
        if (typescript.isStringLiteralLike(e) || typescript.isNumericLiteral(e) || typescript.isPrefixUnaryExpression(e) || [typescript.SyntaxKind.TrueKeyword, typescript.SyntaxKind.FalseKeyword, typescript.SyntaxKind.NullKeyword].includes(e.kind)) {
            return {vals: this.resolve(e, depth + 1, seen, env), negate};
        }
        if (!typescript.isIdentifier(e) && !typescript.isPropertyAccessExpression(e) && !typescript.isElementAccessExpression(e)) {
            return null;
        }
        if (!this.props.propsPath(e) && !typescript.isIdentifier(e)) {
            return null;
        }
        return {vals: conditionContexts(this.resolve(e, depth + 1, seen, env)), negate};
    }

    /** JSX attributes obey left-to-right spread overrides, preserving the conditional arm that supplied a field. */
    attributeValues(tag: JsxTag, name: string, branch?: Value): Value[] {
        let values: SpreadFieldValue[] = [{k: 'absent', missingField: true}];
        for (const attribute of tag.attributes.properties) {
            if (typescript.isJsxAttribute(attribute)) {
                if (attribute.name.getText() === name) {
                    values = attribute.initializer ? this.resolve(attrValue(attribute)) : [lit('true', undefined, 'boolean')];
                }
            } else {
                const fields = this.spreadField(attribute.expression, name, 0, new Set());
                const previous = values;
                values = union(fields.filter((value) => !value.missingField), fields.filter((value) => value.missingField).flatMap((missing) => carryArms(previous.map((value) => ({...value, via: missing.via?.length ? missing.via : value.via})), missing.arms)));
            }
        }
        const attribute = name === 'type' && branch ? [...tag.attributes.properties].reverse().find((field) => typescript.isJsxSpreadAttribute(field) || (typescript.isJsxAttribute(field) && field.name.getText() === name)) : undefined;
        const expression = attribute && typescript.isJsxAttribute(attribute) ? strip(attrValue(attribute)) : undefined;
        const reference = expression && this.narrowKey(expression);
        if (reference) {
            for (const arm of branch?.arms ?? []) {
                const conditions = arm.origins?.map((origin) => this.armConditions.get(origin));
                const stable = conditions?.length && conditions.every((condition) => condition && (condition.getStart() <= expression!.getStart() ? this.siteGuards.stable(condition, expression!) : this.siteGuards.stable(expression!, condition)));
                const identity = stable && conditions[0] ? this.armKey(conditions[0]) : null;
                if (identity?.reference && identity.literal !== undefined && this.narrowKey(identity.reference) === reference) {
                    values = values.filter((value) => {
                        if (value.k === 'lit') {
                            return (value.s === identity.literal) === arm.when;
                        }
                        return value.k !== 'absent' || !arm.when;
                    });
                }
            }
        }
        return values;
    }

    private spreadField(expression: ts.Expression, name: string, depth: number, seen: Set<ts.Node>): SpreadFieldValue[] {
        const node = strip(expression)!;
        if (depth > MAX_RESOLVE_DEPTH || seen.has(node)) {
            return [this.unres('spread-field-unresolved', node)];
        }
        const next = new Set([...seen, node]);
        if (typescript.isConditionalExpression(node)) {
            const condition = this.condition(node.condition, depth + 1, next, null, true);
            const arm = this.armKey(node.condition);
            const positive = withArm(this.spreadField(node.whenTrue, name, depth + 1, next), arm, true);
            const negative = withArm(this.spreadField(node.whenFalse, name, depth + 1, next), arm, false);
            return condition ? [...distribute(positive, condition, true), ...distribute(negative, condition, false)] : [...positive, ...negative];
        }
        if (typescript.isIdentifier(node)) {
            const declaration = this.symbolOf(node)?.valueDeclaration;
            if (declaration && typescript.isVariableDeclaration(declaration) && declaration.initializer && (declaration.parent.flags & typescript.NodeFlags.Const)) {
                return this.spreadField(declaration.initializer, name, depth + 1, next);
            }
        }
        const rest = this.props.restPropsOf(node);
        if (rest && !this.props.mayCarry(node, name, rest.comp ?? undefined)) {
            return [{k: 'absent', missingField: true}];
        }
        const props = rest ?? this.props.propsPath(node);
        if (props?.comp) {
            const comp = props.comp;
            const path = [...props.path, name];
            return this.props.resolveProps(comp, path, depth + 1, next).map((value): SpreadFieldValue => {
                const usage = (this.ix.usages.get(comp) ?? []).find((item) => this.ix.where(usageNode(item)) === value.via?.[0]);
                const missing = usage && this.props.propAt(comp, usage, path, next).kind === 'absent';
                return value.k === 'absent' && missing ? {...value, missingField: true} : value;
            });
        }
        if (node.kind === typescript.SyntaxKind.NullKeyword || node.kind === typescript.SyntaxKind.FalseKeyword || (typescript.isIdentifier(node) && node.text === 'undefined' && !(this.symbolOf(node)?.declarations?.some((declaration) => !this.ix.program.isSourceFileDefaultLibrary(declaration.getSourceFile()))))) {
            return [{k: 'absent', missingField: true}];
        }
        if (typescript.isObjectLiteralExpression(node)) {
            let values: SpreadFieldValue[] = [{k: 'absent', missingField: true}];
            for (const property of node.properties) {
                if (typescript.isSpreadAssignment(property)) {
                    const fields = this.spreadField(property.expression, name, depth + 1, next);
                    const previous = values;
                    values = union(fields.filter((value) => !value.missingField), fields.filter((value) => value.missingField).flatMap((missing) => carryArms(previous, missing.arms)));
                } else if (propName(property.name) === name) {
                    if (typescript.isPropertyAssignment(property)) {
                        values = this.resolve(property.initializer, depth + 1, next);
                    } else if (typescript.isShorthandPropertyAssignment(property)) {
                        values = this.resolve(property.name, depth + 1, next);
                    } else {
                        values = [this.unres('spread-field-unresolved', property)];
                    }
                }
            }
            return values;
        }
        if (name === 'role') {
            const type = this.checker.getNonNullableType(this.checker.getTypeAtLocation(node));
            const members = type.isUnion() ? type.types : [type];
            if (!members.some((member) => this.checker.getPropertyOfType(member, name))) {
                return [{k: 'absent', missingField: true}];
            }
        }
        return this.descend(node, [name], depth + 1, next);
    }

    /** Supported guard values restricted to the mount being rendered. */
    conditionIn(expression: ts.Expression, via: Loc[]): Value[] {
        const condition = this.condition(expression, 0, new Set(), null, true);
        if (!condition) {
            return [];
        }
        return condition.vals.filter((value) => !value.via?.length || prefixCompatible(value.via, via)).map((value) => {
            if (!condition.negate) {
                return value;
            }
            return isFalsy(value) || isTruthy(value) ? {...lit(String(isFalsy(value)), value.via, 'boolean'), arms: value.arms} : this.unres('runtime-condition', expression);
        });
    }

    /**
     * Resolves an expression for one instance: when it reads a prop and the instance's innermost usage is
     * known, only that usage is consulted (no need to walk every usage of a widely used component).
     */
    resolveIn(e: ts.Expression | undefined, via: Loc[] | undefined): Value[] {
        const x = strip(e) as ts.Expression | undefined;
        const pp = x ? this.props.propsPath(x) : null;
        if (x && pp && pp.comp && pp.path.length && via?.length) {
            const u = (this.ix.usages.get(pp.comp) ?? []).find((us) => this.ix.where(usageNode(us)) === via[0]);
            if (u) {
                return this.props.atUsage(pp.comp, u, pp.path, 0, new Set([pp.comp])).map((v) => ({...v, via: [via[0], ...(v.via ?? [])]})).filter((value) => prefixCompatible(value.via, via));
            }
        }
        return this.resolve(e);
    }

    /** Inside templates: runtime data becomes a typed key gap, while missing values remain unresolved. */
    resolveOrGap(e: ts.Expression, depth: number, seen: Set<ts.Node>, env: Env | null, preserveAbsent = false): Value[] {
        const generic = this.generics.genericField(strip(e) as ts.Expression);
        if (generic) {
            return generic;
        }
        const vals = this.resolve(e, depth + 1, seen, env);
        const typed = this.gapFor(strip(e) as ts.Expression);
        const gap = typed.k === 'pat' && typeof typed.parts[0] !== 'string' ? typed.parts[0].gap : null;
        if (gap?.kind === 'id' && gap.entity && gap.field) {
            return vals.map((value) => {
                if (value.k === 'lit') {
                    return value;
                }
                if (value.k === 'absent') {
                    return preserveAbsent ? value : {...this.unres('missing-template-value', e), via: value.via, arms: value.arms};
                }
                return {...typed, via: value.via, arms: value.arms};
            });
        }
        if (vals.length && gap && (gap.kind === 'entity' || gap.kind === 'number' || gap.kind === 'id')) {
            const present = vals.filter((value) => value.k !== 'absent');
            const absent = vals.filter((value) => value.k === 'absent').map((value) => (preserveAbsent ? value : {...this.unres('missing-template-value', e), via: value.via, arms: value.arms}));
            return [...(present.length ? perInstance([typed], {vals: present}) : []), ...absent];
        }
        return vals.
            map((v) => ((v.k === 'unres' && v.why === 'runtime-value') || v.k === 'computed' ? withFrom(this.gapFor(strip(e) as ts.Expression), v, this.ix.where(e)) : v)).
            map((v) => (v.k === 'absent' && !preserveAbsent ? {...this.unres('missing-template-value', e), via: v.via} : v));
    }
}
