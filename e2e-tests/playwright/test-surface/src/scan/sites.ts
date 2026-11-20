// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {suffixValues} from './elements.ts';
import type {ScanDiagnostic, Site, SiteKind} from './types.ts';

import {attrValue, componentName, isIntrinsic, jsxAttr, propName, type JsxTag} from '../ast.ts';
import {isGrammarError, parseTestId} from '../grammar.ts';
import {publishedComponent, type PublishedParts} from '../parts.ts';
import type {ProgramIndex} from '../program_index.ts';
import {typescript} from '../typescript.ts';
import {concat, lit, templateOf, type Gap, type Resolver} from '../values.ts';

/** Discover testid declarations in JSX, spreads, library parts and HTML strings. */
export class SiteCollector {
    private readonly context: {ix: ProgramIndex; R: Resolver; published: PublishedParts[]; diag: ScanDiagnostic};
    constructor(context: {ix: ProgramIndex; R: Resolver; published: PublishedParts[]; diag: ScanDiagnostic}) {
        this.context = context;
    }

    // ---- sites ----------------------------------------------------------------------------

    /** Collect testid declarations from JSX, objects, published parts and embedded markup. */
    collectSites(): Site[] {
        const sites: Site[] = [];
        const testIdProps = new Set(this.context.published.map((l) => l.parts.testIdProp));
        for (const sf of this.context.ix.files) {
            const visit = (n: ts.Node) => {
                if (typescript.isJsxAttribute(n) && ['testId', 'testIdScope'].includes(n.name.getText())) {
                    const expression = attrValue(n);
                    if (expression) {
                        for (const value of this.context.R.resolve(expression)) {
                            const template = templateOf(value);
                            const parsed = template && parseTestId(template);
                            if (parsed && !isGrammarError(parsed) && (parsed.hasKey || parsed.role)) {
                                this.context.diag('key-origin', 'error', this.context.ix.where(n), 'A component scope cannot contain a key or role suffix.', 'Pass the item key separately from the scope.');
                            }
                        }
                    }
                }
                if (typescript.isJsxAttribute(n) && n.name.getText() === 'data-testid') {
                    const tag = n.parent.parent as JsxTag;
                    sites.push(this.site(n, isIntrinsic(tag) ? 'dom' : 'component', tag, attrValue(n) ?? undefined));
                } else if (typescript.isJsxAttribute(n) && testIdProps.has(n.name.getText()) && !isIntrinsic(n.parent.parent as JsxTag)) {
                    sites.push(...this.partSites(n));
                } else if (typescript.isPropertyAssignment(n) && propName(n.name) === 'data-testid' && typescript.isStringLiteral(n.name)) {
                    sites.push(this.site(n, 'object', null, n.initializer));
                } else if (typescript.isStringLiteral(n) || typescript.isNoSubstitutionTemplateLiteral(n)) {
                    sites.push(...this.htmlSites(n));
                } else if (typescript.isTemplateExpression(n)) {
                    // the whole template, so a testid can carry a key (`data-testid="x.mention:${name}--link"`)
                    sites.push(...this.htmlTemplateSites(n));
                }
                typescript.forEachChild(n, visit);
            };
            visit(sf);
        }
        return sites;
    }

    /** Markup written as text (`<span class="x" data-testid="markdown.y--text">${word}</span>`): one site per literal testid on a tag. */
    private htmlSites(n: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateLiteralLikeNode): Site[] {
        const out: Site[] = [];
        for (const m of n.text.matchAll(SiteCollector.HTML_TESTID)) {
            const site = this.site(n, 'html', null, undefined);
            site.values = [lit(m[2] ?? m[3])];
            site.htmlTag = m[1];
            site.htmlAttrs = n.text.slice(m.index, n.text.indexOf('>', m.index));
            out.push(site);
        }
        return out;
    }

    private static readonly HTML_TESTID = /<([a-z][a-z0-9]*)\b[^<>]*?\bdata-testid=(?:"([^"]+)"|'([^']+)')/g;

    /** A template with substitutions: its text with each substitution as a gap, one site per testid on a tag. */
    private htmlTemplateSites(n: ts.TemplateExpression): Site[] {
        if (!n.head.text.includes('<') && !n.templateSpans.some((s) => s.literal.text.includes('<'))) {
            return [];
        }
        const GAP = '\u0001';
        const gaps: Gap[] = [];
        let text = n.head.text;
        for (const span of n.templateSpans) {
            const g = this.context.R.gapFor(span.expression);
            gaps.push((g as {parts: Array<{gap: Gap}>}).parts[0].gap);
            text += GAP + span.literal.text;
        }
        const out: Site[] = [];
        for (const m of text.matchAll(SiteCollector.HTML_TESTID)) {
            const raw = m[2] ?? m[3];
            const valueStart = text.indexOf(raw, m.index);
            let g = [...text.slice(0, valueStart)].filter((c) => c === GAP).length;
            const parts: Array<string | {gap: Gap}> = [];
            let str = '';
            for (const c of raw) {
                if (c === GAP) {
                    if (str) {
                        parts.push(str);
                    }
                    str = '';
                    parts.push({gap: gaps[g++]});
                } else {
                    str += c;
                }
            }
            if (str) {
                parts.push(str);
            }
            const site = this.site(n, 'html', null, undefined);
            site.values = [parts.every((p) => typeof p === 'string') ? lit(parts.join('')) : {k: 'pat', parts}];
            site.htmlTag = m[1];
            site.htmlAttrs = text.slice(m.index, text.indexOf('>', m.index));
            out.push(site);
        }
        return out;
    }

    /** `<Modal testId={x}>` of a library that publishes its parts: one site per part the usage renders. */
    private partSites(attr: ts.JsxAttribute): Site[] {
        const tag = attr.parent.parent as JsxTag;
        const pub = publishedComponent(this.context.ix, tag, this.context.published);
        if (!pub?.component || attr.name.getText() !== pub.lib.parts.testIdProp) {
            return [];
        }
        const expr = attrValue(attr);
        const base = expr ? this.context.R.resolve(expr) : [];
        const out: Site[] = [];

        for (const part of pub.component.parts) {
            if (part.when && Boolean(jsxAttr(tag, part.when.prop)) !== part.when.set) {
                continue;
            }

            // an explicit data-testid on the usage wins over the derived root testid
            if ((part.suffix === '' || part.suffix.startsWith('--')) && jsxAttr(tag, 'data-testid')) {
                continue;
            }
            const site = this.site(attr, 'part', tag, undefined);
            site.values = concat(base, suffixValues(part, `${pub.name}.${pub.lib.parts.testIdProp}`));
            site.part = {...part, component: pub.name};
            out.push(site);
        }
        return out;
    }

    /** Attach declaration ownership, source location and resolved values to one testid site. */
    private site(node: ts.Node, kind: SiteKind, tag: JsxTag | null, expr: ts.Expression | undefined): Site {
        const owner = this.context.R.componentOf(node);
        return {
            node,
            at: this.context.ix.where(node),
            kind,
            tag,
            expr,
            owner,
            ownerName: owner ? componentName(owner) : '(module)',
            values: expr ? this.context.R.resolveAtSite(expr, node) : [{k: 'absent'}],
        };
    }
}
