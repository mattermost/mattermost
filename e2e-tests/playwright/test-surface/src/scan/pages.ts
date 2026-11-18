// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {sectionType, usageAnchor} from './elements.ts';
import type {Emission, ScanDiagnostic} from './types.ts';

import {isJsxTag} from '../ast.ts';
import {cmp} from '../compare.ts';
import {relativeToRoot, type Config} from '../config.ts';
import {isGrammarError} from '../grammar.ts';
import {type Loc, type Page} from '../manifest_types.ts';
import type {ProgramIndex, Usage} from '../program_index.ts';
import {typescript} from '../typescript.ts';
import type {Resolver} from '../values.ts';

/** Collect coarse page render scopes and configured typed sub-route sections. */
export class PageScopes {
    private readonly context: {ix: ProgramIndex; R: Resolver; config: Config; usageByLoc: Map<Loc, Usage>; diag: ScanDiagnostic};
    constructor(context: {ix: ProgramIndex; R: Resolver; config: Config; usageByLoc: Map<Loc, Usage>; diag: ScanDiagnostic}) {
        this.context = context;
    }

    private coarseMemo = new Map<ts.Node, Set<string>>();

    /**
     * Where each scope is decided: the outermost usage its testid's value flowed through (the composer's
     * `center.post_create` belongs to the component that renders `<AdvancedCreatePost location=…>`), or
     * the emission site when the value is fixed there.
     */
    private renderAnchors = new Map<ts.SourceFile, Array<{node: ts.Node; scope: string; container?: string}>>();

    /** Index concrete scope roots at their outermost render anchors for page discovery. */
    anchorEmissions(emissions: Emission[]) {
        for (const e of emissions) {
            if (isGrammarError(e.parsed)) {
                continue;
            }
            const outer = [...e.via].reverse().map((loc) => this.context.usageByLoc.get(loc)).find(Boolean);
            const node = outer ? usageAnchor(outer) : e.site.node;
            const sf = node.getSourceFile();

            // a scope-less container (`file_preview_modal`) is the root its children's scopes start with: it names the
            // component that renders it, though only `scope.name` testids count as scopes elsewhere
            if (!e.parsed.scope.length) {
                continue;
            }

            // a container (`admin.attribute.graph.grant_modal`) is the scope its children start with: a modal whose root
            // sits under another scope is named by that root, not by the scope it nests in
            const container = !e.parsed.role && !e.parsed.hasKey;
            const scope = container ? [...e.parsed.scope, e.parsed.name] : e.parsed.scope;
            this.renderAnchors.set(sf, [...(this.renderAnchors.get(sf) ?? []), {node, scope: scope.join('.')}]);
        }
    }

    /** Scopes anywhere in a component's render tree, ignoring which instance produced them (for pages). */
    scopesRenderedBy(node: ts.Node, stack = new Set<ts.Node>()): Set<string> {
        const memo = this.coarseMemo.get(node);
        if (memo) {
            return memo;
        }
        const out = new Set<string>();
        if (stack.has(node)) {
            return out;
        }
        stack.add(node);
        for (const a of this.renderAnchors.get(node.getSourceFile()) ?? []) {
            if (a.node.pos >= node.pos && a.node.end <= node.end) {
                out.add(a.scope);
            }
        }
        const visit = (n: ts.Node) => {
            if (isJsxTag(n)) {
                const comp = this.context.ix.componentOfTag(n);
                if (comp && !this.context.ix.isLibraryNode(comp)) {
                    for (const sc of this.scopesRenderedBy(comp, stack)) {
                        out.add(sc);
                    }
                }
            }
            typescript.forEachChild(n, visit);
        };
        visit(node);
        stack.delete(node);
        this.coarseMemo.set(node, out);
        return out;
    }

    /**
     * `pageSections`: a page's sub-routes as one optional, typed param. Values `from` a file are the literal values of
     * every property of that name in it; a route param in one (`:user_id(…)`) becomes `${string}`.
     */
    addPageSections(pages: Page[]) {
        const at = relativeToRoot(this.context.config, this.context.config.configPath);
        for (const [cls, sec] of Object.entries(this.context.config.pageSections)) {
            const page = pages.find((p) => p.class === cls);
            if (!page) {
                this.context.diag('pages', 'error', at, `pageSections names ${cls}, which isn't a page.`);
                continue;
            }
            const raw = [...(sec.values ?? [])];
            if (sec.from) {
                const sf = this.context.ix.program.getSourceFile(sec.from.file);
                if (!sf) {
                    this.context.diag('input', 'error', at, `pageSections for ${cls} reads ${relativeToRoot(this.context.config, sec.from.file)}, which isn't part of the program.`);
                    continue;
                }
                const visit = (n: ts.Node) => {
                    if (typescript.isPropertyAssignment(n) && n.name.getText() === sec.from!.property) {
                        for (const v of this.context.R.resolve(n.initializer)) {
                            if (v.k === 'lit') {
                                raw.push(v.s);
                            }
                        }
                    }
                    typescript.forEachChild(n, visit);
                };
                visit(sf);
            }
            const values = [...new Set(raw.map(sectionType).filter(Boolean))].sort(cmp);
            if (!values.length) {
                this.context.diag('pages', 'error', at, `pageSections for ${cls} has no values.`);
                continue;
            }
            const name = sec.param ?? 'section';
            page.params.push({name, as: name, optional: true, values, section: true});
        }
    }
}
