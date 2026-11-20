// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {alwaysReturns, elementOf, NOT_OPERATED, usageAnchor} from './elements.ts';
import type {Emission, Landing, ScanDiagnostic, Site} from './types.ts';

import {exprName, isFunctionLike, isIntrinsic, isJsxTag, jsxAttr, strip, tagName, type JsxTag} from '../ast.ts';
import {isGrammarError, KEY_PLACEHOLDER, parseTestId} from '../grammar.ts';
import {MAX_LANDING_HOPS} from '../limits.ts';
import {type Aria, type Loc} from '../manifest_types.ts';
import {usageNode, type CodeNode, type ProgramIndex, type Usage} from '../program_index.ts';
import {ROLE_TABLE} from '../role_table.ts';
import type {Roles} from '../roles.ts';
import {asWritten, compatible} from '../roles.ts';
import {typescript} from '../typescript.ts';
import {isFalsy, isTruthy, mergeArms} from '../values/algebra.ts';
import {templateOf, type Resolver, type Value} from '../values.ts';

/** Resolve each testid site to its DOM landing, role and guarded mount instances. */
export class DomEmissions {
    private readonly context: {ix: ProgramIndex; R: Resolver; roles: Roles; usageByLoc: Map<Loc, Usage>; diag: ScanDiagnostic};
    constructor(context: {ix: ProgramIndex; R: Resolver; roles: Roles; usageByLoc: Map<Loc, Usage>; diag: ScanDiagnostic}) {
        this.context = context;
    }

    // ---- landing --------------------------------------------------------------------------

    /** The JSX tag inside `comp` that receives its props by spread (`{...props}`, `{...rest}`), if any. */
    private spreadTarget(comp: CodeNode, propPath: string[] = []): JsxTag | null {
        let found: JsxTag | null = null;
        const visit = (n: ts.Node) => {
            if (found) {
                return;
            }
            if (isJsxTag(n)) {
                for (const p of n.attributes.properties) {
                    if (!typescript.isJsxSpreadAttribute(p)) {
                        continue;
                    }
                    const rp = this.context.R.restPropsOf(p.expression) ?? this.context.R.propsPath(p.expression);
                    if (rp && rp.comp === comp && rp.path.join('.') === propPath.join('.')) {
                        found = n;
                        return;
                    }
                }
            }
            typescript.forEachChild(n, visit);
        };
        const body = isFunctionLike(comp) ? comp.body : comp;
        if (body) {
            visit(body);
        }
        return found;
    }

    /**
     * The intrinsic element a component's spread props land on through `React.createElement`, when
     * its type is a tag name or falls back to one (`createElement(props.inputComponent || 'input', {...rest})`).
     */
    private createElementTarget(comp: CodeNode, propPath: string[] = []): string | null {
        let found: string | null = null;
        const visit = (n: ts.Node) => {
            if (found) {
                return;
            }
            if (typescript.isCallExpression(n) && exprName(strip(n.expression) as ts.Expression) === 'createElement' && n.arguments.length >= 2) {
                const props = strip(n.arguments[1]) as ts.Expression;
                const spreads = typescript.isObjectLiteralExpression(props) && props.properties.some((p) => {
                    if (!typescript.isSpreadAssignment(p)) {
                        return false;
                    }
                    const rp = this.context.R.restPropsOf(p.expression) ?? this.context.R.propsPath(p.expression);
                    return Boolean(rp && rp.comp === comp && rp.path.join('.') === propPath.join('.'));
                });
                if (spreads) {
                    let t = strip(n.arguments[0]) as ts.Expression;
                    if (typescript.isBinaryExpression(t) && (t.operatorToken.kind === typescript.SyntaxKind.BarBarToken || t.operatorToken.kind === typescript.SyntaxKind.QuestionQuestionToken)) {
                        t = strip(t.right) as ts.Expression;
                    }
                    if (typescript.isStringLiteralLike(t) && (/^[a-z][a-z0-9]*$/).test(t.text)) {
                        found = t.text;
                        return;
                    }
                }
            }
            typescript.forEachChild(n, visit);
        };
        const body = isFunctionLike(comp) ? comp.body : comp;
        if (body) {
            visit(body);
        }
        return found;
    }

    /**
     * Follows a component usage to the element its spread props land on: intrinsic, or a library component.
     * `hops` are the usages passed through, innermost first (the usage chain for the landing tag's own props).
     */
    private landTag(usage: JsxTag, propPath: string[] = []): {tag: JsxTag; library: boolean; hops: Loc[]; element?: string} | null {
        let tag = usage;
        let path = propPath;
        const hops: Loc[] = [];
        for (let depth = 0; depth < MAX_LANDING_HOPS; depth++) {
            if (isIntrinsic(tag)) {
                return {tag, library: false, hops};
            }
            const comp = this.context.ix.componentOfTag(tag);
            if (!comp || this.context.ix.isLibraryNode(comp)) {
                return {tag, library: true, hops};
            }
            const next = this.spreadTarget(comp, path);
            if (!next) {
                // `createElement(as || 'input', {...rest})`: the usage's attributes land on that tag
                const element = this.createElementTarget(comp, path);
                return element ? {tag, library: false, hops, element} : null;
            }
            hops.unshift(this.context.ix.where(tag));
            tag = next;
            path = [];
        }
        return null;
    }

    /** Find the DOM element and role receiving a site’s testid for this mount chain. */
    landing(site: Site, via: Loc[], branch?: Value): Landing {
        if (site.kind === 'part') {
            const usage = site.tag!;
            const part = site.part!;
            const role = part.role;
            return {
                tag: null,
                aria: {role, native: false, state: []},
                ...(part.native ? {native: part.native} : {}),

                anchor: elementOf(usage),
                interactive: role !== null && Boolean(ROLE_TABLE[role].interactive),
            };
        }
        if (site.kind === 'html') {
            return {tag: null, aria: this.context.roles.ofTagName(site.htmlTag!, site.htmlAttrs), anchor: site.node, interactive: false};
        }
        if (site.kind === 'dom') {
            const tag = site.tag!;
            return {tag, textEntry: this.context.roles.textEntry(tag, via, undefined, branch), aria: this.context.roles.ofIntrinsic(tag, via, undefined, branch), anchor: elementOf(tag), interactive: this.context.roles.isInteractive(tag, via, branch)};
        }
        if (site.kind === 'component') {
            const usage = site.tag!;
            const hasHandlers = usage.attributes.properties.some((a) => typescript.isJsxAttribute(a) && (/^on[A-Z]/).test(a.name.getText()));
            const own = this.usageAria(usage, via);
            const land = this.landTag(usage);
            let aria: Aria = own ?? {role: null, native: false, state: []};
            if (!own && land) {
                const innerVia = [...land.hops, ...via];
                aria = (land.library ? this.context.roles.ofLibrary(land.tag, innerVia) : this.context.roles.ofIntrinsic(land.tag, innerVia, land.element)) ?? aria;
            }
            const interactive = hasHandlers || (aria.role !== null && !NOT_OPERATED.has(aria.role));
            return {tag: land?.tag ?? null, ...(land && !land.library ? {textEntry: this.context.roles.textEntry(land.tag, [...land.hops, ...via], land.element, branch)} : {}), aria, anchor: elementOf(usage), interactive};
        }

        // 'data-testid' in an object literal: follow the object to a component prop that is spread onto an element
        const obj = site.node.parent;
        const attr = obj?.parent?.parent;
        if (attr && typescript.isJsxAttribute(attr) && isJsxTag(attr.parent.parent)) {
            const usage = attr.parent.parent;
            const land = this.landTag(usage, [attr.name.getText()]);
            if (land && land.tag !== usage) {
                const aria = (land.library ? this.context.roles.ofLibrary(land.tag) : this.context.roles.ofIntrinsic(land.tag)) ?? {role: null, native: false, state: []};
                return {tag: land.tag, ...(land.library ? {} : {textEntry: this.context.roles.textEntry(land.tag, via, land.element, branch)}), aria, anchor: elementOf(usage), interactive: !land.library && this.context.roles.isInteractive(land.tag)};
            }
        }
        return {tag: null, aria: {role: null, native: false, state: []}, anchor: site.node, interactive: false};
    }

    /** A tag expression may resolve to different intrinsic elements at different mounts. */
    private landings(site: Site, via: Loc[], testId: Value): Landing[] {
        const tag = site.tag;
        if (site.kind === 'dom' && tag) {
            return this.roleBranches(tag, via, testId).filter((branch) => tagName(tag) !== 'input' || this.context.R.attributeValues(tag, 'type', branch).some((value) => compatible(value, via))).map((branch) => this.landing(site, via, branch));
        }
        if (site.kind !== 'component' || !tag || typescript.isJsxNamespacedName(tag.tagName) || this.context.ix.componentOfTag(tag)) {
            return [this.landing(site, via, testId)];
        }
        const values = this.context.R.resolveIn(tag.tagName, via).filter((value) => compatible(value, via) && !value.arms?.some((arm) => testId.arms?.some((other) => arm.key === other.key && arm.when !== other.when)));
        if (!values.length || values.some((value) => value.k !== 'lit' || !(/^[a-z][a-z0-9]*$/).test(value.s))) {
            return [this.landing(site, via, testId)];
        }
        return values.flatMap((value): Landing[] => this.roleBranches(tag, via, {...testId, arms: mergeArms(testId.arms, value.arms) || undefined}).map((branch): Landing => {
            const element = (value as Value & {s: string}).s;
            return {tag, textEntry: this.context.roles.textEntry(tag, via, element, branch), aria: this.context.roles.ofIntrinsic(tag, via, element, branch), anchor: elementOf(tag), interactive: this.context.roles.intrinsicInteractive(tag, element, via, branch)};
        }));
    }

    /** A missing role in one possible spread arm must not be hidden by another arm's valid role. */
    private roleBranches(tag: JsxTag, via: Loc[], testId: Value): Value[] {
        const branches = this.context.R.attributeValues(tag, 'role').filter((value) => compatible(value, via)).flatMap((value) => {
            const arms = mergeArms(testId.arms, value.arms);
            return arms === false ? [] : [{...testId, arms}];
        });
        return branches.length ? branches : [testId];
    }

    /** Role set at a component usage (`<Button role='switch'>`, `<Button aria-pressed>`), which wins over the component's own. */
    private usageAria(usage: JsxTag, via: Loc[]): Aria | null {
        const role = this.context.roles.attrLiterals(usage, 'role', via);
        if (role && role.length) {
            return {role: asWritten(role[0]), native: false, state: []};
        }
        if (jsxAttr(usage, 'aria-pressed')) {
            return {role: 'togglebutton', native: false, state: ['aria-pressed']};
        }
        return null;
    }

    // ---- emissions ------------------------------------------------------------------------

    /**
     * Whether each usage on an instance's chain can render there: a usage inside `if (props.x)`, `props.x && …`
     * or `props.x ? … :` is impossible for an instance whose own usage doesn't pass `x`.
     */
    private renderedFor(via: Loc[]): boolean {
        for (let i = 0; i < via.length - 1; i++) {
            const u = this.context.usageByLoc.get(via[i]);
            if (u && this.guardedOff(usageAnchor(u), via.slice(i + 1))) {
                return false;
            }
        }
        return true;
    }

    /** Prove that enclosing conditions prevent a declaration from rendering at this mount. */
    private guardedOff(node: ts.Node, outer: Loc[]): boolean {
        const comp = this.context.R.componentOf(node);
        const guards: Array<{cond: ts.Expression; positive: boolean}> = [];
        for (let child = node, p = node.parent; p && p !== comp; child = p, p = p.parent) {
            if (typescript.isIfStatement(p) && child !== p.expression) {
                guards.push({cond: p.expression, positive: child === p.thenStatement});
            } else if (typescript.isConditionalExpression(p) && child !== p.condition) {
                guards.push({cond: p.condition, positive: child === p.whenTrue});
            } else if (typescript.isBinaryExpression(p) && p.operatorToken.kind === typescript.SyntaxKind.AmpersandAmpersandToken && child === p.right) {
                guards.push({cond: p.left, positive: true});
            } else if (typescript.isBlock(p)) {
                // an earlier `if (x) return …;` in the same block: code after it runs only when `x` is falsy
                for (const st of p.statements) {
                    if (st === child) {
                        break;
                    }
                    if (typescript.isIfStatement(st) && !st.elseStatement && alwaysReturns(st.thenStatement)) {
                        guards.push({cond: st.expression, positive: false});
                    }
                }
            }
        }
        for (const g of guards) {
            let positive = g.positive;
            let c = strip(g.cond) as ts.Expression;
            while (typescript.isPrefixUnaryExpression(c) && c.operator === typescript.SyntaxKind.ExclamationToken) {
                positive = !positive;
                c = strip(c.operand) as ts.Expression;
            }

            // Local const aliases of prop comparisons are guards too (isModal = location === MODAL).
            const vals = this.context.R.conditionIn(c, outer);
            const off = vals.length > 0 && vals.every(isFalsy);
            const on = vals.length > 0 && vals.every(isTruthy);
            if ((positive && off) || (!positive && on)) {
                return true;
            }
        }
        return false;
    }

    /** Produce per-instance grammar and DOM landings for resolved, renderable testid values. */
    emissions(sites: Site[]): Emission[] {
        // component sites whose values a DOM site inside the component already emits (the same value through that
        // usage: another prop of the same usage, like an input's clear button testid, doesn't cover it)
        const covered = new Map<Loc, Set<string>>();
        const text = (v: Value) => (v.k === 'lit' ? v.s : templateOf(v));

        // a value that renders no testid covers nothing: an absent one (`clearTestId ? … : undefined` at a usage without
        // clearTestId), and one built from a prop the usage doesn't pass (`${menuTestId}.paper` without menuTestId)
        const rendersNothing = (v: Value) => v.k === 'absent' || (v.k === 'unres' && v.why === 'missing-template-value');
        for (const s of sites) {
            if (s.kind !== 'dom') {
                continue;
            }
            for (const v of s.values) {
                if (rendersNothing(v)) {
                    continue;
                }
                const t = text(v);
                for (const u of v.via ?? []) {
                    const set = covered.get(u) ?? new Set<string>();
                    set.add(t ?? '');
                    covered.set(u, set);
                }
            }
        }
        const coveredBy = (site: Site) => (site.kind === 'component' ? covered.get(this.context.ix.where(site.tag!)) : undefined);

        // a component site nothing inside covers is where the testid lands as far as the scan can see (an icon
        // component chosen at run time, a library component), and so is a forwarded `{...{'data-testid': x}}`
        // object: the usages it came through forward to it
        const addCover = (s: Site, into: Map<Loc, Set<string>>) => {
            for (const v of s.values) {
                if (rendersNothing(v)) {
                    continue;
                }
                for (const u of v.via ?? []) {
                    const set = into.get(u) ?? new Set<string>();
                    set.add(text(v) ?? '');
                    into.set(u, set);
                }
            }
        };
        const terminal = new Map<Loc, Set<string>>();
        for (const s of sites) {
            if ((s.kind === 'component' || s.kind === 'object') && !coveredBy(s) && s.values.some((v) => v.via?.length)) {
                addCover(s, terminal);
            }
        }
        for (const [loc, set] of terminal) {
            const prev = covered.get(loc);
            covered.set(loc, prev ? new Set([...prev, ...set]) : set);
        }
        const out: Emission[] = [];
        const fileDiagnostics = new Set<string>();
        for (const site of sites) {
            const inner = coveredBy(site);
            const isCovered = (v: Value) => Boolean(inner && (inner.has(text(v) ?? '') || inner.has('')));
            if (inner && site.values.every((v) => v.k === 'absent' || isCovered(v))) {
                site.forwarded = true;
                continue;
            }
            let concreteTemplates: string[] | null = null;
            const concrete = () => {
                concreteTemplates ??= site.values.filter((v) => !(v.k === 'pat' && v.recursive)).map(templateOf).filter((t): t is string => t !== null);
                return concreteTemplates;
            };
            const emittedValues = new Set<string>();
            for (const value of site.values) {
                if (value.k === 'absent' || isCovered(value)) {
                    continue;
                }

                // Arms constrain expression assembly. Once the value is complete, the same landing and
                // usage chain describe one element even when several mutually exclusive derivations produced it.
                const identity = JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'arms').sort(([a], [b]) => a.localeCompare(b))));
                if (emittedValues.has(identity)) {
                    continue;
                }
                emittedValues.add(identity);
                const via = value.via ?? [];
                if (!via.length && site.tag && site.owner) {
                    const usages = this.context.ix.usages.get(site.owner) ?? [];
                    if (usages.length && usages.every((usage) => this.guardedOff(site.tag!, [this.context.ix.where(usageNode(usage))]))) {
                        continue;
                    }
                }

                // the element isn't rendered for this instance: a usage on its chain sits under a prop that's absent there
                if (via.length > 1 && !this.renderedFor(via)) {
                    continue;
                }

                // …or the site itself sits under one (`if (iconOnly) return <button …/>` for an instance without iconOnly)
                if (via.length && site.tag && this.guardedOff(site.tag, via)) {
                    continue;
                }
                const raw = templateOf(value);
                if (raw === null) {
                    continue;
                }

                // a recursive component's own scope fed back into itself (`<ContainerBlock testIdScope={testIdScope}/>`
                // inside the blocks ContainerBlock renders) leaves the scope unknown at the cycle; when an outer instance
                // already renders the same element (`center.post_list.post.action:{key}--button` for
                // `{key}.action:{key}--button`), the cycle adds nothing. (A recursion that reaches an element no outer
                // instance does, or builds a key, stays.)
                if (value.k === 'pat' && value.recursive && raw.startsWith(KEY_PLACEHOLDER)) {
                    const rest = raw.slice(KEY_PLACEHOLDER.length);
                    if (concrete().some((t) => t.endsWith(rest))) {
                        continue;
                    }
                }
                for (const landing of this.landings(site, via, value)) {
                    const parsed = parseTestId(raw);
                    const fileTag = landing.tag;
                    const inputTypes = fileTag && isIntrinsic(fileTag) && tagName(fileTag) === 'input' ? this.context.roles.attrLiterals(fileTag, 'type', via) : null;
                    const file = Boolean(landing.native || (inputTypes?.length && inputTypes.every((type) => type === 'file')) || (site.htmlTag === 'input' && (/\btype\s*=\s*['"]file['"]/).test(site.htmlAttrs ?? '')));
                    if (file) {
                        landing.native = 'file';
                        if (!isGrammarError(parsed) && parsed.hasKey && !fileDiagnostics.has(`key:${site.at}`)) {
                            fileDiagnostics.add(`key:${site.at}`);
                            this.context.diag('key-origin', 'error', site.at, 'A file input is addressed as a part of its item, not by its own key.');
                        }
                        if (!isGrammarError(parsed) && parsed.role && !fileDiagnostics.has(`role:${site.at}`)) {
                            fileDiagnostics.add(`role:${site.at}`);
                            this.context.diag('grammar', 'error', site.at, 'A native file input testid has no role suffix.', 'Remove the role suffix and address the input with its FileInputDriver.');
                        }
                    }

                    let template = raw;
                    let key: string | null = null;
                    if (!isGrammarError(parsed) && parsed.hasKey && parsed.key !== null) {
                        key = parsed.key;
                        template = raw.replace(':' + parsed.key, ':' + KEY_PLACEHOLDER);
                    }
                    out.push({site, value, template, key, parsed, via, landing});
                }
            }
        }
        return out;
    }
}
