// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type ts from 'typescript';

import {attrValue, isJsxTag, jsxAttr, returnsOf, strip, type JsxTag} from './ast.ts';
import {componentName} from './ast.ts';
import type {PageParamConfig} from './config.ts';
import {pascal} from './generate/names.ts';
import type {Loc, Page} from './manifest_types.ts';
import type {CodeNode, ProgramIndex} from './program_index.ts';
import {typescript} from './typescript.ts';
import type {Resolver} from './values.ts';

/** A route param: its name, whether it is optional, and the values its pattern allows (`(channels|messages)`). */
export type RouteParam = {name: string; optional: boolean; values?: string[]};

/** `/:team([a-z]+)/:path(channels|messages)/:id?` -> segments and params. */
export function parseRoute(path: string): {params: RouteParam[]; segments: Array<string | RouteParam>} {
    const segments: Array<string | RouteParam> = [];
    const params: RouteParam[] = [];
    let i = 0;
    let literal = '';
    while (i < path.length) {
        if (path[i] !== ':') {
            literal += path[i++];
            continue;
        }
        if (literal) {
            segments.push(literal);
            literal = '';
        }
        let j = i + 1;
        while (j < path.length && (/[A-Za-z0-9_]/).test(path[j])) {
            j++;
        }
        const name = path.slice(i + 1, j);
        let values: string[] | undefined;
        if (path[j] === '(') {
            let depth = 0;
            let k = j;
            for (; k < path.length; k++) {
                if (path[k] === '(') {
                    depth++;
                } else if (path[k] === ')') {
                    depth--;
                    if (depth === 0) {
                        break;
                    }
                }
            }
            const pattern = path.slice(j + 1, k);
            if ((/^[a-z_-]+(\|[a-z_-]+)*$/i).test(pattern)) {
                values = pattern.split('|');
            }
            j = k + 1;
        }
        const optional = path[j] === '?';
        if (optional) {
            j++;
        }
        const p: RouteParam = {name, optional, ...(values ? {values} : {})};
        params.push(p);
        segments.push(p);
        i = j;
    }
    if (literal) {
        segments.push(literal);
    }
    return {params, segments};
}

/** The route as written for people: `/:team/:path(channels|messages)/:identifier/:postid?` (regexes dropped). */
export function displayPath(path: string): string {
    return parseRoute(path).segments.map((s) => {
        if (typeof s === 'string') {
            return s;
        }
        return `:${s.name}${s.values ? `(${s.values.join('|')})` : ''}${s.optional ? '?' : ''}`;
    }).join('');
}

const ROUTE_TAG = /(^|\.)(\w*Route)$/;

/**
 * The webapp's route table: `<Route path component|render>` (and LoggedInRoute, HFRoute…), with paths
 * resolved through the value resolver (constants, template literals) and the component each renders.
 */
export function discoverRoutes(ix: ProgramIndex, R: Resolver): Array<{path: string; component: CodeNode; at: Loc}> {
    const out: Array<{path: string; component: CodeNode; at: Loc}> = [];
    for (const sf of ix.files) {
        const visit = (n: ts.Node) => {
            if (isJsxTag(n) && ROUTE_TAG.test(n.tagName.getText()) && jsxAttr(n, 'path')) {
                const comp = routeComponent(ix, n);
                if (comp && !ix.isLibraryNode(comp)) {
                    for (const v of R.resolve(attrValue(jsxAttr(n, 'path')))) {
                        if (v.k === 'lit' && v.s.startsWith('/')) {
                            out.push({path: v.s, component: comp, at: ix.where(n)});
                        }
                    }
                }
            }
            typescript.forEachChild(n, visit);
        };
        visit(sf);
    }
    return out;
}

function routeComponent(ix: ProgramIndex, tag: JsxTag): CodeNode | null {
    const component = attrValue(jsxAttr(tag, 'component'));
    if (component) {
        return ix.unwrapExpr(component);
    }
    const render = strip(attrValue(jsxAttr(tag, 'render'))) as ts.Expression | undefined;
    if (render && (typescript.isArrowFunction(render) || typescript.isFunctionExpression(render))) {
        for (const r of returnsOf(render)) {
            const el = firstJsx(r);
            const c = el && ix.componentOfTag(el);
            if (c) {
                return c;
            }
        }
    }
    return null;
}

function firstJsx(e: ts.Node): JsxTag | null {
    let found: JsxTag | null = null;
    const visit = (n: ts.Node) => {
        if (found) {
            return;
        }
        if (isJsxTag(n)) {
            found = n;
            return;
        }
        typescript.forEachChild(n, visit);
    };
    visit(e);
    return found;
}

/** Manifest pages: one per route path, named after the component it renders (or the config's name for it). */
export function buildPages(
    routes: Array<{path: string; component: CodeNode; at: Loc}>,
    ix: ProgramIndex,
    scopesOf: (n: ts.Node) => Set<string>,
    names: Record<string, string>,
    typed: Record<string, PageParamConfig>,
): Page[] {
    const byPath = new Map<string, Page>();
    const used = new Map<string, string>();
    for (const r of routes) {
        const path = displayPath(r.path);
        if (byPath.has(path)) {
            continue;
        }
        const comp = componentName(r.component);
        let cls = names[comp] ?? `${pascal(comp.replace(/(Page|Controller)$/, ''))}Page`;
        if (used.has(cls) && used.get(cls) !== path) {
            const words = parseRoute(r.path).segments.filter((s): s is string => typeof s === 'string').join('_');
            cls = `${pascal(words) || pascal(comp)}Page`;
        }
        used.set(cls, path);
        const params = parseRoute(r.path).params.map((p) => {
            const t = typed[p.name];
            return {
                name: p.name,
                as: t?.as ?? p.name,
                optional: p.optional,
                ...(p.values ? {values: p.values} : {}),
                ...(t ? {entity: {type: t.entity, field: t.field, module: t.module}} : {}),
            };
        });
        byPath.set(path, {class: cls, path, params, scopes: [...scopesOf(r.component)].sort(), component: {name: comp, at: ix.where(r.component)}});
    }
    return [...byPath.values()].sort((a, b) => (a.path < b.path ? -1 : Number(a.path > b.path)));
}
