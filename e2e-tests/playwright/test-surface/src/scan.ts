// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {attrValue, componentName, jsxAttr, strip} from './ast.ts';
import {cmp, cmpLoc, cmpLocs} from './compare.ts';
import {Conditions} from './conditions.ts';
import {relativeToRoot, type Config} from './config.ts';
import {isGrammarError} from './grammar.ts';
import {MAX_CONDITION_USAGES} from './limits.ts';
import {MANIFEST_VERSION, type Aria, type Diagnostic, type Element, type Loc, type Manifest, type RenderCondition, type RuleName} from './manifest_types.ts';
import {buildPages, discoverRoutes} from './pages.ts';
import {loadPublishedParts, type PublishedParts} from './parts.ts';
import {PortalLookup} from './portal_lookup.ts';
import type {LoadedProgram} from './program.ts';
import {fileOfLoc, isCallUsage, ProgramIndex, usageNode, type CodeNode, type Usage} from './program_index.ts';
import {reachableFiles} from './reachability.ts';
import {Roles} from './roles.ts';
import {Operations} from './routes.ts';
import {addForms, isUnscoped, usageAnchor} from './scan/elements.ts';
import {DomEmissions} from './scan/emitter.ts';
import {fixedSets, incompatibleKinds, keyInfo, keyKinds} from './scan/keys.ts';
import {ScanMetadata} from './scan/metadata.ts';
import {PageScopes} from './scan/pages.ts';
import {PropRenderUses} from './scan/prop_render_uses.ts';
import {RenderScopes} from './scan/scopes.ts';
import {SiteCollector} from './scan/sites.ts';
import type {Emission, ScanResult, ScanStats, Site} from './scan/types.ts';
import {typescript} from './typescript.ts';
import {isFalsy, isTruthy} from './values/algebra.ts';
import {gapsOf, isTruncated, Resolver, templateOf, type Gap} from './values.ts';
export {commonScope, isUnscoped, readHostSlots} from './scan/elements.ts';
export type {Emission, HostSlot, Landing, ScanResult, ScanStats, Site, SiteKind} from './scan/types.ts';

export class Scanner {
    private readonly sites: SiteCollector;
    private readonly emitter: DomEmissions;
    private readonly scopes: RenderScopes;
    private readonly pages: PageScopes;
    private readonly metadata: ScanMetadata;
    private readonly published: PublishedParts[];
    readonly ix: ProgramIndex;
    readonly R: Resolver;
    readonly roles: Roles;
    readonly conditions: Conditions;
    readonly ops: Operations;
    private readonly portals: PortalLookup;
    private readonly config: Config;
    private readonly usageByLoc = new Map<Loc, Usage>();
    private readonly diagnostics: Diagnostic[] = [];
    private dynamicConverged = false;
    private readonly timings: Record<string, number> = {};

    constructor(loaded: LoadedProgram, config: Config, previous?: ProgramIndex) {
        this.config = config;
        let t = Date.now();
        this.ix = new ProgramIndex(loaded, config, previous);
        this.timings.index = Date.now() - t;
        this.R = new Resolver(this.ix);
        this.diagnostics.push(...this.R.keyFieldDiagnostics);
        this.published = loadPublishedParts(config, this.diagnostics);
        this.roles = new Roles(this.ix, this.R, this.published);
        this.conditions = new Conditions(this.ix, this.R);
        t = Date.now();
        this.ops = new Operations(this.ix);
        this.diagnostics.push(...this.ops.diagnostics);
        this.timings.routes = Date.now() - t;
        t = Date.now();
        const dynamic = this.ix.addDynamicUsages((e) => this.R.sources(e).filter((x): x is {expr: ts.Expression; via: Loc[]} => !('marker' in x)).flatMap((src) => {
            // a member of a parameter no call site sets (a method called through a lookup table): its typed literals
            const x = strip(src.expr) as ts.Expression;
            const typed = typescript.isPropertyAccessExpression(x) ? this.R.typedMemberSources(x) : [];
            return typed.length ? typed.map((expr) => ({expr, via: src.via})) : [src];
        }));
        this.dynamicConverged = dynamic.converged;
        if (!dynamic.converged) {
            this.diag('input', 'error', relativeToRoot(config, config.configPath), `Dynamically rendered components were still being found after ${dynamic.passes} passes (${dynamic.usages} usages): the components they render may be missing.`, 'Inspect the chain of components passed as props, or raise DYNAMIC_PASS_BUDGET if it is genuinely that deep.');
        }
        this.timings.dynamicUsages = Date.now() - t;
        this.ix.resolveDialogMounts((expression) => this.R.sources(expression).map((source) => ('marker' in source ? {} : {expr: source.expr})));
        for (const expression of this.ix.unresolvedDialogs) {
            this.diag('input', 'error', this.ix.where(expression), 'A dialogType candidate mount has no statically resolved component.', 'Use a finite component reference or declare the structural mount explicitly.');
        }
        this.R.enableMemoization();
        for (const us of this.ix.usages.values()) {
            for (const u of us) {
                this.usageByLoc.set(this.ix.where(usageNode(u)), u);
            }
        }
        this.portals = new PortalLookup(this.ix, config, this.diagnostics);
        this.portals.validate();
        this.sites = new SiteCollector({ix: this.ix, R: this.R, published: this.published, diag: (...args) => this.diag(...args)});
        this.emitter = new DomEmissions({ix: this.ix, R: this.R, roles: this.roles, usageByLoc: this.usageByLoc, diag: (...args) => this.diag(...args)});
        this.scopes = new RenderScopes({ix: this.ix, R: this.R, portals: this.portals, usageByLoc: this.usageByLoc, diag: (...args) => this.diag(...args)});
        this.pages = new PageScopes({ix: this.ix, R: this.R, config: this.config, usageByLoc: this.usageByLoc, diag: (...args) => this.diag(...args)});
        this.metadata = new ScanMetadata({ix: this.ix, config: this.config, published: this.published});
        Object.assign(this.timings, loaded.timings);
    }

    /** Discover declarations before producing per-mount emissions. */
    collectSites(): Site[] {
        return this.sites.collectSites();
    }

    /** Append a scanner diagnostic with its exact source location and optional repair. */
    private diag(rule: RuleName, severity: Diagnostic['severity'], at: Loc, message: string, fix?: string) {
        this.diagnostics.push({rule, severity, at, message, ...(fix ? {fix} : {})});
    }

    /**
     * Elements the app can't render: no emission site is in a file the entries reach, or every usage chain
     * passes through a file they don't (a menu item written in a component nothing imports).
     */
    private reachablePaths: Set<string> | null = null;

    private markUnreachable(elements: Element[]) {
        const files = new Set([...reachableFiles(this.ix.program, this.config.entries)].map((f) => this.ix.rel(f)));
        this.reachablePaths = files;
        const live = (loc: Loc) => files.has(fileOfLoc(loc));
        for (const el of elements) {
            const sites = [el.component.at, ...(el.alsoAt ?? [])];
            if (!sites.some(live) || !el.instances.some((i) => i.via.every(live))) {
                el.unreachable = true;
            }
        }
    }

    /** Collect the render conditions of a declaration and the mounts that produce this instance. */
    private conditionsOf(e: Emission): RenderCondition[] {
        const out = this.conditions.of(e.landing.anchor);
        const expression = e.site.expr && strip(e.site.expr);
        if (expression && typescript.isConditionalExpression(expression)) {
            const yes = this.R.resolveIn(expression.whenTrue, e.via).some((value) => templateOf(value) === e.template);
            const no = this.R.resolveIn(expression.whenFalse, e.via).some((value) => templateOf(value) === e.template);
            const condition = this.R.resolveIn(expression.condition, e.via);
            const on = condition.length > 0 && condition.every(isTruthy);
            const off = condition.length > 0 && condition.every(isFalsy);
            if (yes !== no && !on && !off) {
                out.push(...this.conditions.of(yes ? expression.whenTrue : expression.whenFalse));
            }
        }

        // conditions at the usages the testid flowed through (`{canX && <Item/>}` in the parent)
        for (const loc of e.via.slice(0, MAX_CONDITION_USAGES)) {
            const u = this.usageByLoc.get(loc);
            if (u) {
                out.push(...this.conditions.of(usageAnchor(u)));
            }
        }

        // a literal testid inside a component: conditions where that component is rendered (when it is rendered in few places)
        const owner = e.site.owner;
        const calls = owner ? this.ix.calls.get(owner) ?? [] : [];
        if (calls.length && calls.length <= MAX_CONDITION_USAGES) {
            const atCalls = calls.map((call) => this.conditions.of(call));
            if (atCalls.every((conditions) => conditions.length)) {
                out.push(...atCalls.flat());
            }
        }
        const usages = owner && !e.via.length ? this.ix.usages.get(owner) ?? [] : [];
        if (usages.length && usages.length <= MAX_CONDITION_USAGES) {
            for (const u of usages) {
                out.push(...this.conditions.of(usageAnchor(u)));
            }
        }
        return out;
    }

    // ---- manifest -------------------------------------------------------------------------

    /** Assemble provenance, structural metadata and diagnostics from the indexed program. */
    scan(): ScanResult {
        let t = Date.now();
        const sites = this.sites.collectSites();
        const emissions = this.emitter.emissions(sites);
        this.timings.testids = Date.now() - t;
        for (const e of emissions) {
            const sf = e.site.node.getSourceFile();
            const list = this.scopes.emissionsByFile.get(sf) ?? [];
            list.push(e);
            this.scopes.emissionsByFile.set(sf, list);
        }

        t = Date.now();
        const byTemplate = new Map<string, Emission[]>();
        for (const e of emissions) {
            const list = byTemplate.get(e.template) ?? [];
            list.push(e);
            byTemplate.set(e.template, list);
        }

        const elements: Element[] = [];
        for (const [template, list] of byTemplate) {
            list.sort((a, b) => cmpLoc(a.site.at, b.site.at) || cmpLocs(a.via, b.via));
            const first = list[0];
            const parsed = first.parsed;
            const valid = !isGrammarError(parsed);
            if (new Set(list.map((emission) => emission.landing.native ?? '')).size > 1) {
                this.diag('collisions', 'error', first.site.at, `"${template}" lands on both a native file input and another element.`, 'Give the file input its own testid.');
            }

            // conditions that hold wherever the element renders (a condition of one site only isn't one of the element's)
            const siteConds: Array<Map<string, RenderCondition>> = [];
            const instances = new Map<string, {via: Loc[]; keySet: Set<string>}>();
            const keyValues = new Set<string>();
            const gaps: Gap[] = [];
            let aria: Aria = first.landing.aria;
            for (const e of list) {
                siteConds.push(new Map(this.conditionsOf(e).map((c) => [c.at + ' ' + c.expr, c])));
                const ik = e.via.join(' < ');
                const inst = instances.get(ik) ?? {via: e.via, keySet: new Set<string>()};
                if (e.key !== null) {
                    inst.keySet.add(e.key);
                    keyValues.add(e.key);
                }
                instances.set(ik, inst);
                gaps.push(...gapsOf(e.value));
                if (!aria.role && e.landing.aria.role) {
                    aria = e.landing.aria;
                }
            }
            const sitesAt = [...new Set(list.map((e) => e.site.at))];
            const el: Element = {
                template,
                grammar: valid,
                scope: valid ? parsed.scope : [],
                name: valid ? parsed.name : template,
                role: valid ? parsed.role : null,
                component: {name: first.site.ownerName, at: first.site.at},
                instances: [...instances.values()].
                    map((i) => ({via: i.via, ...(i.keySet.size ? {keySet: [...i.keySet].sort()} : {})})).
                    sort((a, b) => cmpLocs(a.via, b.via)),
                ...(first.landing.native ? {native: first.landing.native} : {}),
                aria: {...aria, state: [...new Set(aria.state)].sort()},
            };
            if (sitesAt.length > 1) {
                el.alsoAt = sitesAt.slice(1);
            }
            if (valid && parsed.hasKey) {
                el.key = keyInfo(keyValues, gaps);
                const kinds = keyKinds(keyValues, gaps);
                if (kinds && incompatibleKinds(kinds)) {
                    const labels = [...kinds].map((kind) => kind.split(' [')[0]);
                    const descriptions = [...kinds].map((kind, index) => (labels.filter((label) => label === labels[index]).length > 1 ? kind : labels[index]));
                    this.diag('collisions', 'error', first.site.at, `"${template}" is keyed two ways at its mounts (${descriptions.sort().join(', ')}): one name, two key kinds: give the second its own name.`, 'Pass a distinct testId at the mounts whose key is the other kind (an optional testId prop on the component), so each name has one key kind.');
                }
                const sources = [...new Set(list.flatMap((emission) => (emission.value.setSource ? [emission.value.setSource] : [])))];
                if (el.key && sources.length === 1) {
                    el.key.setSource = sources[0];
                }
            }
            const conds = siteConds.reduce((all, here) => new Map([...all].filter(([k]) => here.has(k))));
            if (conds.size) {
                el.renderedWhen = [...conds.values()].sort((a, b) => cmpLoc(a.at ?? '', b.at ?? '') || cmp(a.expr, b.expr));
            }
            elements.push(el);
        }
        this.timings.analysis = Date.now() - t;

        // Scope membership comes from rendered JSX and candidate component mounts, never handlers.
        t = Date.now();
        this.pages.anchorEmissions(emissions);
        const components = [...this.ix.dialogRefs.keys()].map((node) => ({name: componentName(node as CodeNode), at: this.ix.where(node), scopes: [...this.scopes.scopesOf(node)].sort()}));
        this.scopes.addNestedScopes(elements, byTemplate);
        this.timings.scopes = Date.now() - t;

        t = Date.now();
        const pages = buildPages(discoverRoutes(this.ix, this.R), this.ix, (n) => this.pages.scopesRenderedBy(n), this.config.pageNames, this.config.pageParams);
        for (const [cls, entry] of Object.entries(this.config.pageReady)) {
            const page = pages.find((p) => p.class === cls);
            if (!page) {
                this.diag('pages', 'error', relativeToRoot(this.config, this.config.configPath), `pageReady names ${cls}, which isn't a page.`);
                continue;
            }
            if (!Array.isArray(entry)) {
                if (!entry.reason) {
                    this.diag('pages', 'error', relativeToRoot(this.config, this.config.configPath), `pageReady for ${cls} has no ready testid and no reason.`, 'Name a testid the page renders, or say why it has none (`{"ready": null, "reason": …}`).');
                    continue;
                }
                page.noReady = entry.reason;
                continue;
            }
            const ready = entry;

            // an element of its own (a scope can be only a prefix), rendered under the page
            const missing = ready.filter((r) => !elements.some((e) => e.template === r && !e.key && (page.scopes.includes(r) || page.scopes.includes(e.scope.join('.')))));
            if (missing.length) {
                this.diag('pages', 'error', page.component.at, `pageReady for ${cls} names ${missing.map((r) => `\`${r}\``).join(', ')}, which the page doesn't render as an element.`, 'Name a testid the page renders, whose element is its own (not only a scope prefix).');
                continue;
            }
            page.ready = ready;
        }
        this.pages.addPageSections(pages);
        this.timings.pages = Date.now() - t;

        addForms(elements);
        const sets = fixedSets(elements, this.config, this.diagnostics);
        const operations = [...this.ops.byId.values()].sort((a, b) => cmp(a.opId, b.opId)).map((op) => ({opId: op.opId, verb: op.verb, path: op.path, body: op.body, ...(op.bodyImports ? {bodyImports: op.bodyImports} : {}), inSpec: op.inSpec}));
        const specGaps = [...this.ops.byId.values()].filter((o) => !o.inSpec).map((o) => ({client: o.client, verb: o.verb, path: o.path})).sort((a, b) => cmp(a.client, b.client));

        elements.sort((a, b) => cmp(a.template, b.template));
        if (this.config.entries.length) {
            t = Date.now();
            this.markUnreachable(elements);
            this.timings.reachability = Date.now() - t;
        }
        if (this.ix.resolverError) {
            this.diag('input', 'warning', relativeToRoot(this.config, this.config.tsconfig), `The type checker failed on ${this.ix.stats.resolverErrors} symbol lookups (first: ${this.ix.resolverError}); what they name is left out of the scan.`, 'Check that the program type-checks (tsc) with the config\'s pathOverrides.');
        }
        const manifest: Manifest = {
            version: MANIFEST_VERSION,
            generatedFrom: {
                tsconfig: relativeToRoot(this.config, this.config.tsconfig),
                scope: this.config.include.map((d) => relativeToRoot(this.config, d)),
                ...(this.config.libraries.length ? {libraries: this.metadata.libraries()} : {}),
            },
            elements,
            sets,
            operations,
            pages,
            pluginSlots: this.metadata.pluginSlots(),
            ...(this.config.plugin ? {plugin: this.metadata.pluginInfo()} : {}),
            components,
        };
        const usageNodeAt = (loc: Loc) => {
            const u = this.usageByLoc.get(loc);
            return u ? usageAnchor(u) : undefined;
        };
        const usageNameAt = (loc: Loc) => {
            const u = this.usageByLoc.get(loc);
            if (!u) {
                return undefined;
            }
            const node = isCallUsage(u) ? this.ix.unwrapExpr(u.call.expression) : this.ix.componentOfTag(u);
            return node ? componentName(node) : undefined;
        };
        const allOperations = [...this.ops.byId.values()].map(({opId, verb, path: route, body, bodyImports}) => ({opId, verb, path: route, body, ...(bodyImports ? {bodyImports} : {})}));
        const scopeOwners = new Map<string, {name?: string; declaration?: string}>();
        const scopeOwnerAt = (scope: string, via: Loc[], declaration = false): string | undefined => {
            const key = scope + '@' + via.join('<');
            let owner = scopeOwners.get(key);
            if (!owner) {
                owner = {};
                for (let index = via.length - 1; index >= 0; index--) {
                    const usage = this.usageByLoc.get(via[index]);
                    if (!usage || isCallUsage(usage)) {
                        continue;
                    }
                    const matched = ['testId', 'testIdScope'].some((prop) => {
                        const value = attrValue(jsxAttr(usage, prop));
                        return value && this.R.resolveIn(value, via.slice(index + 1)).some((resolved) => resolved.k === 'lit' && resolved.s === scope);
                    });
                    if (matched) {
                        const target = this.ix.componentOfTag(usage);
                        owner = {name: usageNameAt(via[index]), ...(target ? {declaration: this.ix.ref(target)} : {})};
                        break;
                    }
                }
                scopeOwners.set(key, owner);
            }
            return declaration ? owner.declaration : owner.name;
        };
        const knownFiles = new Set(this.ix.files.map((file) => this.ix.rel(file.fileName)));
        const isReachable = (at: Loc, via: Loc[] = []) => !this.reachablePaths || [at, ...via].every((loc) => {
            const file = fileOfLoc(loc);
            return !knownFiles.has(file) || this.reachablePaths!.has(file);
        });
        const notReachableFiles = [...new Set(sites.flatMap((site) => [site.at, ...site.values.flatMap((value) => value.via ?? [])]).filter((at) => !isReachable(at)).map(fileOfLoc))].sort(cmp);
        const propUses = new PropRenderUses(this.ix, this.R, this.dynamicConverged);
        return {isReachable, notReachableFiles, uniqueMountChain: (node) => propUses.uniqueMountChain(node), propRenderUses: (creation, mount) => propUses.of(creation, mount), manifest, scopeOwnerAt, stats: this.stats(sites, emissions, elements), sites, emissions, specGaps, usageNodeAt, usageNameAt, allOperations, urlVersion: this.config.client?.urlVersion ?? null, diagnostics: this.diagnostics};
    }

    /** Summarize resolution coverage, bounded graph work and scanner timings. */
    private stats(sites: Site[], emissions: Emission[], elements: Element[]): ScanStats {
        const dom = sites.filter((s) => s.kind === 'dom');
        const resolvedSite = (s: Site) => {
            const real = s.values.filter((v) => v.k !== 'absent');
            return real.length > 0 && real.every((v) => (v.k === 'lit' || v.k === 'pat') && !isUnscoped(v));
        };
        const fromProps = dom.filter((s) => s.expr && this.usesProps(s.expr));
        return {
            ...this.ix.stats,
            ...this.scopes.scopeGraph.stats(),
            renderScopeViaDepth: this.scopes.scopeContextDepth,
            timings: {...this.timings},
            sites: sites.length,
            domSites: dom.length,
            domResolved: dom.filter(resolvedSite).length,
            domFromProps: fromProps.length,
            domFromPropsResolved: fromProps.filter(resolvedSite).length,
            componentSites: sites.filter((s) => s.kind === 'component').length,
            forwardedComponentSites: sites.filter((s) => s.forwarded).length,
            objectSites: sites.filter((s) => s.kind === 'object').length,
            emissions: emissions.length,
            elements: elements.length,
            grammarElements: elements.filter((e) => e.grammar).length,
            elementsWithRole: elements.filter((e) => e.aria.role).length,
            elementsWithConditions: elements.filter((e) => e.renderedWhen?.length).length,

            // testid sites and navigations whose values were cut at a cap (`truncated` diagnostics)
            truncatedTestIdSites: sites.filter((s) => s.values.some(isTruncated)).length,
            truncatedValues: this.R.truncatedAt.size,
            ...this.ops.stats,
        };
    }

    /** Determine whether an expression reads any component prop. */
    private usesProps(e: ts.Expression): boolean {
        let found = false;
        const v = (n: ts.Node) => {
            if (!found && this.R.propsPath(n)) {
                found = true;
            }
            if (!found) {
                typescript.forEachChild(n, v);
            }
        };
        v(e);
        return found;
    }
}
