// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Output} from './data.ts';
import {Imports} from './imports.ts';
import {mountConst, mountType, scopeAccessor, type Model} from './model.ts';
import {docText, propKey, str} from './names.ts';

import {cmp} from '../compare.ts';
import type {Diagnostic} from '../manifest_types.ts';
import type {PageDecl, PageParam} from '../report_types.ts';

const RESERVED_PAGE_MEMBERS = new Set(['page', 'goto', 'route', 'path', 'pathFor', 'ready', 'constructor']);

const nameOf = (p: PageParam) => p.as ?? p.name;

/** A param with fixed values has a default (the first), so it may be left out. */
const optional = (p: PageParam) => Boolean(p.optional || p.section || (p.values && !p.entity));

function paramType(p: PageParam, imp: Imports): string {
    if (p.entity) {
        return `Pick<${imp.type(p.entity.type, p.entity.from)}, ${str(p.entity.field)}> | string`;
    }
    if (p.values) {
        return p.values.map(str).join(' | ');
    }
    return 'string';
}

function paramValue(p: PageParam): string {
    const v = `params.${nameOf(p)}`;
    if (p.entity) {
        return p.optional ? `${v} === undefined ? undefined : keyOf(${v}, ${str(p.entity.field)})` : `keyOf(${v}, ${str(p.entity.field)})`;
    }
    if (p.values && !p.optional) {
        return `${v} ?? ${str(p.values[0])}`;
    }
    return v;
}

function paramDoc(p: PageParam): string {
    const parts: string[] = [];
    if (p.section) {
        parts.push('a sub-route below the page\'s path');
    } else if (p.entity) {
        parts.push(`a ${p.entity.type} or its ${p.entity.field}`);
    } else if (p.values) {
        parts.push(`default \`${docText(p.values[0])}\``);
    }
    if (nameOf(p) !== p.name) {
        parts.push(`(route param \`:${p.name}\`)`);
    }
    return parts.length ? `    /** ${parts.join(' ')} */\n` : '';
}

/** `get ready()`: the page's ready testids as locators, of which one shows the page is up. */
function readyGetter(page: PageDecl, imp: Imports): string {
    const ready = page.ready ?? [];
    const L = imp.locator();
    const doc = ready.length ? `${ready.map((r) => `\`${docText(r)}\``).join(' or ')} shows the page is up.` : 'The report gives this page no ready element: `clickTo` and `pressTo` do not accept it.';
    return `    /** ${doc} */
    get ready(): readonly [${ready.map(() => L).join(', ')}] {
        return [${ready.map((r) => `this.page.getByTestId(${str(r)})`).join(', ')}];
    }`;
}

/** `pages.ts`: one class per route, with typed params, `path(params)`, `goto(params)` and its scopes. */
export function emitPages(model: Model, out: Output, diagnostics: Diagnostic[]): string {
    const imp = new Imports('pages', out.runtime);
    const classes: string[] = [];
    for (const name of Object.keys(model.report.pages).sort(cmp)) {
        if (model.exported.get(name) !== 'pages') {
            continue;
        }
        const page = model.report.pages[name];
        const params = page.params ?? [];
        const Params = `${name}Params`;
        const fields = params.map((p) => `${paramDoc(p)}    ${propKey(nameOf(p))}${optional(p) ? '?' : ''}: ${paramType(p, imp)};`).join('\n');
        const required = params.some((p) => !optional(p));
        const arg = params.length ? `params: ${Params}${required ? '' : ' = {}'}` : '';
        const instanceArg = params.length ? `params${required ? '' : '?'}: ${Params}` : '';
        let surfaceParams = 'void';
        if (params.length) {
            surfaceParams = required ? Params : `${Params} | void`;
        }
        const routeParams = params.filter((p) => !p.section);
        if (routeParams.some((p) => p.entity)) {
            imp.value('keyOf');
        }
        imp.value('buildPath');
        const values = routeParams.length ? `{${routeParams.map((p) => `${propKey(p.name)}: ${paramValue(p)}`).join(', ')}}` : '{}';

        // a sub-route goes below the page's path as written (it may hold slashes)
        const sections = params.filter((p) => p.section).map((p) => ` + (params.${nameOf(p)} ? \`/\${params.${nameOf(p)}}\` : '')`).join('');
        const seen = new Set(RESERVED_PAGE_MEMBERS);
        const accessors = [...page.scopes].sort(cmp).flatMap((scope) => {
            const mount = model.report.scopes[scope];
            const f = mount && model.families.get(mount.family);
            const member = scopeAccessor(scope);
            if (!f || seen.has(member)) {
                diagnostics.push({rule: 'generate', severity: 'error', at: name, message: f ? `Page ${name}'s scope "${scope}" would be generated as "${member}", which the page already has.` : `Page ${name} renders "${scope}", which the report has no scope for.`});
                return [];
            }
            seen.add(member);
            const file = model.scopeFile.get(scope)!;
            const cls = imp.sibling(f.name, f.file);
            const T = `${cls}<${imp.siblingType(mountType(scope), file)}>`;
            return [`
    /** \`${scope}\` */
    get ${member}(): ${T} {
        return new ${cls}(this.page, ${str(scope)}, ${imp.sibling(mountConst(scope), file)});
    }`];
        });
        const base = `${imp.value('SurfacePage')}<${surfaceParams}, ${page.ready?.length ? 'true' : 'false'}>`;
        classes.push(`${params.length ? `export type ${Params} = {\n${fields}\n};\n\n` : ''}/** \`${docText(page.path)}\`, rendered by \`${docText(page.source)}\`. */
export class ${name} extends ${base} {
    static readonly route = ${str(page.path)};

    /** The URL path for these params. */
    static path(${arg}): string {
        return buildPath(${name}.route, ${values})${sections};
    }

    pathFor(${instanceArg}): string {
        return ${name}.path(${params.length ? 'params' : ''});
    }

${readyGetter(page, imp)}
${accessors.join('\n')}
}`);
    }
    const file = imp.finish(classes.length ? classes.join('\n\n') : 'export {};');
    return `${out.header}
${file.imports}

${file.body}
`;
}
