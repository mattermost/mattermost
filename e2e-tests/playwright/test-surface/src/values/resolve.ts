// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {carryArms, concat, conditionContexts, distinctValues, distribute, isFalsy, isTruthy, lit, mergeArms, perInstance, prefixCompatible, TOO_MANY_VALUES, truncated, union, withArm, withFrom, withoutEmptyMember} from './algebra.ts';
import {ArmKeys} from './arms.ts';
import {collectionKey} from './collections.ts';
import {GenericInference} from './generic.ts';
import {ImportedWrites} from './imported_writes.ts';
import {KeyClassifier} from './keys.ts';
import {PropTracer, type ResolveHooks} from './props.ts';
import {SiteGuards} from './site_guards.ts';
import {SourceTracer} from './sources.ts';
import {assignmentsOf, isLet} from './type_utils.ts';
import {alwaysTruthy, dataGap, literalsFromType, typedHere, type TypedDeps} from './typed.ts';
import type {Env, Source, Value} from './types.ts';
import {writeCanEstablishAssignment} from './writes.ts';

import {attrValue, type JsxTag, calleeName, isFunctionLike, peelNot, propName, returnsOf, strip, type FunctionLike} from '../ast.ts';
import {guardsAround} from '../conditions.ts';
import {MAX_HELPER_RETURNS, MAX_RESOLVE_DEPTH} from '../limits.ts';
import type {Loc} from '../manifest_types.ts';
import type {ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';
import {usageNode} from '../usage.ts';

type SpreadFieldValue = Value & {missingField?: true};

/**
 * Resolves expressions to the strings they can produce, following props to every usage
 * (with provenance), spreads, rest props, local objects, constants (incl. namespace imports),
 * useMemo, helper-function returns, and fixed lists behind .map callbacks.
 *
 * One mutually recursive algorithm (`resolve`, `resolveIdentifier`, `resolveCall`, `descend`, `condition`) owns
 * this class; logic that never recurses lives in the sibling modules (arms, collections, grouped_keys, writes, typed, ...).
 *
 * Interface the scanner uses (scan/, roles.ts, parts.ts, conditions.ts, pages.ts):
 * - `resolve(expr)`: every value an expression can produce, with mount provenance (`via`) and conditional arms.
 * - `resolveIn(expr, via)`: the same for one instance, consulting only that mount's usage of a prop.
 * - `resolveAtSite(expr, site)`: resolve under the stable runtime guards around the site that renders it.
 * - `attributeValues(tag, name, branch?)`: a JSX attribute after left-to-right spread overrides.
 * - `conditionIn(expr, via)`: a guard's values restricted to one mount.
 * - `branchTruth(expr, branch, site)`: the truth of a stable condition in a resolved conditional arm.
 * - `enableMemoization()`, once dynamic component usages are indexed; `truncatedAt`, the places values were capped.
 * - `props`, `sourceTrace`, `keys`: the prop, source and key-identity tracers the resolution is built on.
 *
 * `unres` and `descend` are public for the tracers' callbacks (`ResolveHooks`), not for the scanner.
 */
export class Resolver implements ResolveHooks {
    /** Where a value comes from: the expressions supplying it, with their mount provenance. */
    readonly sourceTrace: SourceTracer;

    /** Components, prop reads and their values at each mount. */
    readonly props: PropTracer;

    /** The declared identity of a runtime key, and the key-field diagnostics. */
    readonly keys: KeyClassifier;
    private readonly generics: GenericInference;
    private readonly siteGuards: SiteGuards;
    private readonly arms: ArmKeys;
    private readonly keyDeps: TypedDeps;
    private readonly importedWrites: ImportedWrites;
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
        this.arms = new ArmKeys({ix, stable: (condition, site) => this.siteGuards.stable(condition, site)});
        this.keys = new KeyClassifier(ix);
        this.keyDeps = {ix, keys: this.keys};
        this.generics = new GenericInference(ix, this.keys);
        this.props = new PropTracer(ix, this.keys, this);
        this.sourceTrace = new SourceTracer(ix, this.keys, this.props);
    }

    /** Represent an unreadable expression at its source, retaining known object truthiness. */
    unres(why: string, n?: ts.Node): Value {
        const v: Value = {k: 'unres', why, at: n ? this.ix.where(n) : ''};
        return n && alwaysTruthy(this.checker, n) ? {...v, truthy: true} : v;
    }

    /** Truth of the same stable reference in a resolved conditional tag arm. */
    branchTruth(expression: ts.Expression, branch: Value, site: ts.Node): boolean | 'unstable' | null {
        return this.arms.branchTruth(expression, branch, site);
    }

    private readonly narrowed = new Map<string, 'truthy' | 'present' | 'defined' | 'nonNull'>();

    /** A reference a condition can narrow: an identifier or a props path, keyed by where it is declared. */
    private narrowKey(e: ts.Expression): string | null {
        if (typescript.isIdentifier(e)) {
            const d = this.ix.symbolAt(e)?.valueDeclaration;
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
        const peeled = peelNot(cond);
        let c = peeled.expr;
        let positive = whenTrue !== peeled.negated;
        let mode: 'truthy' | 'present' | 'defined' | 'nonNull' = 'truthy';

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
    descend(expr: ts.Expression | undefined, rest: string[], depth: number, seen: Set<ts.Node>): Value[] {
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
            const d = this.ix.symbolAt(x)?.valueDeclaration;
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
        return [dataGap(this.keyDeps, x, rest)];
    }

    /** Resolve one source path while retaining the source’s mount and branch provenance. */
    private descendSource(src: Source, rest: string[], depth: number, seen: Set<ts.Node>): Value[] {
        const vals = 'marker' in src ? [dataGap(this.keyDeps, src.src, rest, true)] : this.descend(src.expr, rest, depth + 1, seen);
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
            const value = this.keys.gapFor(x);
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
            return [{...this.keys.gapFor(x), recursive: true} as Value];
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
            const arm = this.arms.armKey(x.condition);
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
                return [{...this.keys.gapFor(x), recursive: true} as Value];
            }
            if (!pp.path.length) {
                return [this.unres('whole-props-object', x)];
            }
            const r = this.props.resolveProps(pp.comp, pp.path, depth + 1, new Set([...seen, seen.has(pp.comp) ? again : pp.comp]));
            return r.flatMap((v) => {
                if (v.k === 'unres' && v.why === 'component-has-no-static-usage') {
                    return literalsFromType(this.checker, x)?.map((value) => ({...value, ...(v.via ? {via: v.via} : {}), ...(v.arms ? {arms: v.arms} : {})})) ?? [{...this.keys.gapFor(x), libraryRendered: true, via: v.via} as Value];
                }
                return v.k === 'unres' && v.why === 'from-connect' ? {...this.keys.gapFor(x), via: v.via} as Value : typedHere(this.keys, v, x);
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
                return this.descend(cc.init, cc.rest, depth + 1, seen).map((value) => typedHere(this.keys, value, x));
            }
            if (cc && cc.items) {
                return cc.items.flatMap((it) => this.descendSource(it, cc.rest, depth, seen)).map((value) => typedHere(this.keys, value, x));
            }
        }
        if (typescript.isCallExpression(x)) {
            const r = this.resolveCall(x, depth, seen, env);
            if (!r.every((v) => v.k === 'computed')) {
                return r;
            }
            return literalsFromType(this.checker, x) ?? r;
        }

        // `true` / `false` (a prop passed `={true}`, a default `= false`), as a valueless attribute is 'true'
        if (x.kind === typescript.SyntaxKind.TrueKeyword || x.kind === typescript.SyntaxKind.FalseKeyword) {
            return [lit(x.kind === typescript.SyntaxKind.TrueKeyword ? 'true' : 'false', undefined, 'boolean')];
        }

        // nothing more precise: the declared type's literals (as const members, literal unions)
        return literalsFromType(this.checker, x) ?? [this.unres('runtime-value', x)];
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

    /** Trace a named value through its declaration, assignments, arguments and collection bindings. */
    private resolveIdentifier(x: ts.Identifier, depth: number, seen: Set<ts.Node>, env: Env | null): Value[] | null {
        const sym = this.ix.symbolAt(x);
        const d = this.ix.resolveAlias(sym)?.valueDeclaration;
        if (!d) {
            return null;
        }
        const collection = collectionKey(this.keyDeps, d);
        if (collection) {
            return [collection];
        }
        if (typescript.isVariableDeclaration(d) && (d.initializer || isLet(d))) {
            if (seen.has(d)) {
                return [{...this.keys.gapFor(x), recursive: true} as Value];
            }

            // let x = ...; if (...) x = ...  (or `let x: T;` assigned later)
            const s2 = isLet(d) ? new Set([...seen, d]) : seen;
            const initial = d.initializer ? this.resolve(d.initializer, depth + 1, s2, env) : [{k: 'absent', at: this.ix.where(d)} as Value];
            const vals: Value[] = initial.filter((value) => value.k !== 'absent');
            let unassigned: Value[] = initial.filter((value) => value.k === 'absent');
            for (const rhs of assignmentsOf(d, this.checker.getSymbolAtLocation(d.name) ?? sym!, this.checker)) {
                let assigned = this.resolve(rhs, depth + 1, s2, env);
                for (const guard of guardsAround(rhs, {stop: isFunctionLike, orElse: true, nullish: true})) {
                    const arm = guard.nullish ? {key: `nullish:${this.ix.where(guard.expr)}`, negate: false} : this.arms.armKey(guard.expr) ?? {key: `guard:${this.ix.where(guard.expr)}`, negate: false};
                    const condition = guard.nullish ? {
                        vals: this.resolve(guard.expr, depth + 1, s2, env).map((value): Value => {
                            if (value.k === 'absent' || value.k === 'lit' || isTruthy(value)) {
                                return {...lit(String(value.k === 'absent'), value.via, 'boolean'), arms: value.arms};
                            }
                            return value;
                        }),
                        negate: false,
                    } : this.condition(guard.expr, depth + 1, s2, env, true);
                    assigned = withArm(assigned, arm, guard.when);
                    if (condition) {
                        assigned = distribute(assigned, condition, guard.when);
                    }
                }
                if (writeCanEstablishAssignment(rhs, x, d)) {
                    unassigned = [];
                }
                vals.push(...assigned);
            }
            const declared = literalsFromType(this.checker, x);
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
                return [this.keys.gapFor(x)];
            }
            if (idx === 1 && this.sourceTrace.listsPassedTo(fn).some((list) => this.checker.isArrayLikeType(this.checker.getTypeAtLocation(list)))) {
                return [this.keys.gapFor(x)];
            }
            const cs = this.ix.calls.get(fn) ?? [];
            if (!cs.length) {
                // `const render = (x) => …` passed by name, `list.map(render)`: the list's elements, or key data
                const lists = idx === 0 ? this.sourceTrace.listsPassedTo(fn) : [];
                if (lists.length) {
                    const items = lists.map((l) => this.sourceTrace.arrayElements(l));
                    return items.every(Boolean) ? items.flatMap((it) => it!).flatMap((it) => this.descendSource(it, [], depth, seen)) : [this.keys.gapFor(x)];
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
        return [alwaysTruthy(this.checker, x) ? {k: 'computed', at: this.ix.where(x), truthy: true} : {k: 'computed', at: this.ix.where(x)}];
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
        const {expr: e, negated: negate} = peelNot(c);
        if (comparisons && typescript.isIdentifier(e)) {
            const declaration = this.ix.symbolAt(e)?.valueDeclaration;

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
                const conditions = arm.origins?.map((origin) => this.arms.conditionAt(origin));
                const stable = conditions?.length && conditions.every((condition) => condition && (condition.getStart() <= expression!.getStart() ? this.siteGuards.stable(condition, expression!) : this.siteGuards.stable(expression!, condition)));
                const identity = stable && conditions[0] ? this.arms.armKey(conditions[0]) : null;
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
            const arm = this.arms.armKey(node.condition);
            const positive = withArm(this.spreadField(node.whenTrue, name, depth + 1, next), arm, true);
            const negative = withArm(this.spreadField(node.whenFalse, name, depth + 1, next), arm, false);
            return condition ? [...distribute(positive, condition, true), ...distribute(negative, condition, false)] : [...positive, ...negative];
        }
        if (typescript.isIdentifier(node)) {
            const declaration = this.ix.symbolAt(node)?.valueDeclaration;
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
        if (node.kind === typescript.SyntaxKind.NullKeyword || node.kind === typescript.SyntaxKind.FalseKeyword || (typescript.isIdentifier(node) && node.text === 'undefined' && !(this.ix.symbolAt(node)?.declarations?.some((declaration) => !this.ix.program.isSourceFileDefaultLibrary(declaration.getSourceFile()))))) {
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
    private resolveOrGap(e: ts.Expression, depth: number, seen: Set<ts.Node>, env: Env | null, preserveAbsent = false): Value[] {
        const generic = this.generics.genericField(strip(e) as ts.Expression);
        if (generic) {
            return generic;
        }
        const vals = this.resolve(e, depth + 1, seen, env);
        const typed = this.keys.gapFor(strip(e) as ts.Expression);
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
            map((v) => ((v.k === 'unres' && v.why === 'runtime-value') || v.k === 'computed' ? withFrom(this.keys.gapFor(strip(e) as ts.Expression), v, this.ix.where(e)) : v)).
            map((v) => (v.k === 'absent' && !preserveAbsent ? {...this.unres('missing-template-value', e), via: v.via} : v));
    }
}
