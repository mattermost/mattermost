// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {camel, isIdentifier, pageGetter, RESERVED_MEMBERS, roleWord, scopeName} from './names.ts';

import {cmp} from '../compare.ts';
import type {Diagnostic} from '../manifest_types.ts';
import {CONTAINER, type Child, type Family, type Key, type Mount, type Part, type SurfaceReport} from '../report_types.ts';
import {ROLE_TABLE} from '../role_table.ts';

/**
 * What the generator emits, decided from the report before any code is written: which file each family and mount goes
 * to, every member's name, and which scopes the app roots. Every clash is found here, so emitting never renames.
 */

/** A module a generated file imports from, without `.ts`: `api`, `recaps`, `shared`. */
export type FileName = string;

/** Files the generator always owns: a top-level scope with one of these names goes to `<word>_scope.ts`. */
const FIXED_FILES = new Set(['api', 'sets', 'shared', 'app', 'pages', 'msg', 'index']);

export type Member =
    | {kind: 'container'; member: 'container'; part: Part} |
    {kind: 'part'; name: string; member: string; part: Part} |
    {kind: 'keyedPart'; name: string; member: string; list: string; part: Part; key: Key | {kind: 'mount'}} |
    {kind: 'child'; name: string; member: string; child: Child; portal: boolean} |
    {kind: 'keyedChild'; name: string; member: string; list: string; child: Child; key: Key | {kind: 'mount'}; portal: boolean} |
    {kind: 'renders'; scope: string; member: string};

export type FamilyModel = {
    name: string;
    family: Family;
    file: FileName;

    /** Every scope that is a mount of this family, sorted. */
    mounts: string[];
    members: Member[];

    /** The element names the binding has: `$container`, the parts, the children. */
    bindingNames: string[];

    /** Whether some family has this one as a keyed child (its own element is a repeated item). */
    item: boolean;

    /** Two or more fields a value can be set on: `fill(values)`, and `read()` when every field can be read back. */
    form?: {fields: Array<Extract<Member, {kind: 'part'}>>; readable: boolean};

    /** A repeated item's text parts, when it has no readable form: `read()` returns them. */
    row?: Array<Extract<Member, {kind: 'part'}>>;
};

export type Model = {
    report: SurfaceReport;
    families: Map<string, FamilyModel>;

    /** The file each scope's mount type and constant go to. */
    scopeFile: Map<string, FileName>;

    /** Scopes no family has as a child: the app (and pages) root them. Sorted. */
    topLevel: string[];

    /** Every name a generated file exports, and where: `index.ts` re-exports them all, so each must be unique. */
    exported: Map<string, FileName>;
};

export const mountType = (scope: string) => `${scopeName(scope)}Mount`;
export const mountConst = (scope: string) => `${camel(scopeName(scope))}Mount`;
export const bindingType = (family: string) => `${family}Binding`;

/** The file a scope's mount goes to: its first word's. */
export function fileOfScope(scope: string): FileName {
    const word = scope.split('.')[0];
    return FIXED_FILES.has(word) ? `${word}_scope` : word;
}

/** A top-level scope's accessor: `admin.plugin` -> `adminPlugin`. */
export const scopeAccessor = (scope: string) => camel(scopeName(scope));

export function buildModel(report: SurfaceReport, diagnostics: Diagnostic[]): Model {
    const error = (at: string, message: string, fix?: string) => diagnostics.push({rule: 'generate', severity: 'error', at, message, ...(fix ? {fix} : {})});

    const mountsOf = new Map<string, string[]>();
    for (const [scope, mount] of Object.entries(report.scopes).sort((a, b) => cmp(a[0], b[0]))) {
        if (!report.families[mount.family]) {
            error(scope, `Scope "${scope}" is a mount of "${mount.family}", which the report has no family for.`);
            continue;
        }
        mountsOf.set(mount.family, [...(mountsOf.get(mount.family) ?? []), scope]);
    }

    const keyedChildren = new Set<string>();
    const childScopes = new Set<string>();
    for (const [name, family] of Object.entries(report.families)) {
        for (const [word, child] of Object.entries(family.children ?? {})) {
            if (child.key) {
                keyedChildren.add(child.family);
            }
            for (const at of mountsOf.get(name) ?? []) {
                childScopes.add(`${at}.${word}`);
            }
        }
    }

    const families = new Map<string, FamilyModel>();
    for (const name of Object.keys(report.families).sort(cmp)) {
        const family = report.families[name];
        if (!isIdentifier(name)) {
            error(name, `Family "${name}" is not a valid class name.`, 'Name it in familyNames in the surface config.');
            continue;
        }
        const mounts = mountsOf.get(name) ?? [];
        const words = new Set(mounts.map(fileOfScope));
        const file = words.size === 1 ? [...words][0] : 'shared';
        const members = membersOf(report, name, family, mounts, error);
        const parts = members.filter((m): m is Extract<Member, {kind: 'part'}> => m.kind === 'part');
        const fields = parts.filter((m) => m.part.role && !m.part.native && ROLE_TABLE[m.part.role].fill);
        const form = fields.length >= 2 ? {fields, readable: fields.every((m) => ROLE_TABLE[m.part.role!].read)} : undefined;
        const texts = parts.filter((m) => m.part.role === 'text');
        const row = keyedChildren.has(name) && texts.length && !form?.readable ? texts : undefined;
        families.set(name, {name, family, file, mounts, members, bindingNames: bindingNames(family), item: keyedChildren.has(name), ...(form ? {form} : {}), ...(row ? {row} : {})});
    }

    const scopeFile = new Map<string, FileName>();
    for (const scope of Object.keys(report.scopes)) {
        scopeFile.set(scope, fileOfScope(scope));
    }
    for (const [scope, mount] of Object.entries(report.scopes)) {
        checkBind(report, scope, mount, error);
    }

    const topLevel = Object.keys(report.scopes).filter((s) => !childScopes.has(s) && report.families[report.scopes[s].family]).sort(cmp);
    const exported = exportedNames(report, families, scopeFile, error);
    return {report, families, scopeFile, topLevel, exported};
}

/** The binding's property names, sorted: `$container` first (it sorts before letters). */
function bindingNames(family: Family): string[] {
    return [...(family.container ? [CONTAINER] : []), ...Object.keys(family.parts ?? {}), ...Object.keys(family.children ?? {})].sort(cmp);
}

function membersOf(report: SurfaceReport, name: string, family: Family, mounts: string[], error: (at: string, message: string, fix?: string) => void): Member[] {
    const members: Member[] = [];
    if (family.container?.native) {
        error(name, `${name}'s own element is a native file input, which has nothing under it to be a scope of.`, 'Give the file input its own testid word inside the scope.');
    } else if (family.container) {
        members.push({kind: 'container', member: 'container', part: family.container});
    }
    for (const [word, part] of Object.entries(family.parts ?? {}).sort((a, b) => cmp(a[0], b[0]))) {
        if (family.children?.[word]) {
            error(name, `"${word}" is both a part and a child of ${name}.`);
            continue;
        }

        // the runtime has a file input driver for a part, not for a repeated one: a wrong driver would compile
        if (part.native && part.key) {
            error(name, `${name}'s "${word}" is a repeated native file input, which the runtime has no driver for.`, 'Give each file input a testid word of its own, or wrap the repeated items in a keyed child that holds one.');
            continue;
        }
        if (part.key) {
            members.push({kind: 'keyedPart', name: word, member: camel(word), list: `${camel(word)}List`, part, key: part.key});
        } else {
            members.push({kind: 'part', name: word, member: camel(word) + roleWord(part.role), part});
        }
    }
    for (const [word, child] of Object.entries(family.children ?? {}).sort((a, b) => cmp(a[0], b[0]))) {
        if (!report.families[child.family]) {
            error(name, `Child "${word}" of ${name} is a mount of "${child.family}", which the report has no family for.`);
            continue;
        }
        const portal = childPortal(report, name, word, mounts, error);
        if (child.key) {
            members.push({kind: 'keyedChild', name: word, member: camel(word), list: `${camel(word)}List`, child, key: child.key, portal});
        } else {
            members.push({kind: 'child', name: word, member: camel(word), child, portal});
        }
    }
    for (const scope of family.renders ?? []) {
        members.push({kind: 'renders', scope, member: scopeAccessor(scope)});
    }

    const seen = new Map<string, string>();
    for (const m of members) {
        const label = labelOf(m);
        const names = 'list' in m ? [m.member, m.list] : [m.member];
        for (const n of names) {
            if (m.kind !== 'container' && RESERVED_MEMBERS.has(n)) {
                error(name, `${name}'s ${label} would be generated as "${n}", a name the runtime's Scope reserves.`, 'Rename the testid word (the collisions rule lists the reserved names).');
            }
            const prev = seen.get(n);
            if (prev) {
                error(name, `${name}'s ${label} and ${prev} would both be generated as "${n}".`, 'Rename one of the testid words.');
            }
            seen.set(n, label);
        }
    }
    return members;
}

function labelOf(m: Member): string {
    if (m.kind === 'renders') {
        return `rendered scope "${m.scope}"`;
    }
    return m.kind === 'container' ? 'its own element' : `"${m.name}"`;
}

/**
 * Whether a child is found from the page (a modal, a menu) or inside its parent's root. The parent's class says it once
 * for every mount, so the mounts must agree.
 */
function childPortal(report: SurfaceReport, family: string, word: string, mounts: string[], error: (at: string, message: string) => void): boolean {
    const portals = new Set(mounts.map((m) => Boolean(report.scopes[`${m}.${word}`]?.portal)));
    if (portals.size > 1) {
        error(family, `Child "${word}" of ${family} is in a portal at some mounts and not at others (${mounts.map((m) => `${m}.${word}`).join(', ')}).`);
    }
    return portals.has(true);
}

/** A mount's `bind` names only members of its family, gives keys only where the family leaves them to it, and has its children's scopes. */
function checkBind(report: SurfaceReport, scope: string, mount: Mount, error: (at: string, message: string) => void) {
    const family = report.families[mount.family];
    if (!family) {
        return;
    }
    for (const [word, pb] of Object.entries(mount.bind ?? {})) {
        const part = word === CONTAINER ? family.container : family.parts?.[word];
        const child = family.children?.[word];
        if (!part && !child) {
            error(scope, `Scope "${scope}" binds "${word}", which ${mount.family} has no part or child of that name.`);
            continue;
        }
        const mountKeyed = (part ?? child)!.key?.kind === 'mount';
        if (mountKeyed && (pb === false || !pb.key)) {
            error(scope, `"${scope}.${word}" is keyed by its mount, but the mount says nothing about the key.`);
        }
        if (!mountKeyed && pb !== false && pb.key) {
            error(scope, `Scope "${scope}" gives "${word}" a key, but ${mount.family} fixes that key itself.`);
        }
        if (child && pb === false) {
            error(scope, `Scope "${scope}" marks the child "${word}" as never rendered: only parts can be; a mount without that child is a family of its own.`);
        }
    }
    for (const [word, child] of Object.entries(family.children ?? {})) {
        if (child.key?.kind === 'mount' && !(mount.bind?.[word] as {key?: Key} | undefined)?.key) {
            error(scope, `"${scope}.${word}" is keyed by its mount, but the mount says nothing about the key.`);
        }
        if (!report.scopes[`${scope}.${word}`]) {
            error(scope, `"${scope}.${word}" is a child of ${mount.family}, but the report has no scope for it.`);
        }
    }
}

function exportedNames(report: SurfaceReport, families: Map<string, FamilyModel>, scopeFile: Map<string, FileName>, error: (at: string, message: string, fix?: string) => void): Map<string, FileName> {
    const out = new Map<string, FileName>();
    const add = (name: string, file: FileName, what: string) => {
        const prev = out.get(name);
        if (prev !== undefined) {
            error(what, `"${name}" would be exported by both ${prev}.ts and ${file}.ts (${what}).`, 'Rename one of them (familyNames or pageNames in the surface config).');
            return;
        }
        out.set(name, file);
    };
    add('Api', 'api', 'the operations');
    add('App', 'app', 'the app');
    add('Msg', 'msg', 'the i18n catalog');
    for (const set of Object.keys(report.sets).sort(cmp)) {
        add(set, 'sets', `set ${set}`);
    }
    for (const [name, f] of families) {
        add(name, f.file, `family ${name}`);
        add(bindingType(name), f.file, `family ${name}`);
        if (f.form) {
            add(`${name}FormValues`, f.file, `family ${name}`);
        }
        if (f.form?.readable) {
            add(`${name}FormRead`, f.file, `family ${name}`);
        }
        if (f.row) {
            add(`${name}Texts`, f.file, `family ${name}`);
        }
    }
    for (const scope of [...scopeFile.keys()].sort(cmp)) {
        add(mountType(scope), scopeFile.get(scope)!, `scope ${scope}`);
        add(mountConst(scope), scopeFile.get(scope)!, `scope ${scope}`);
    }
    for (const page of Object.keys(report.pages).sort(cmp)) {
        if (!isIdentifier(page)) {
            error(page, `Page "${page}" is not a valid class name.`, 'Name it in pageNames in the surface config.');
            continue;
        }
        add(page, 'pages', `page ${page}`);
        add(`${page}Params`, 'pages', `page ${page}`);
    }
    return out;
}

/** The App's members: one accessor per top-level scope, one getter per page, and `plugins`. Clashes are errors. */
export function appMembers(model: Model, diagnostics: Diagnostic[]): {scopes: Array<{scope: string; member: string}>; pages: Array<{page: string; member: string}>} {
    const seen = new Map<string, string>([['page', 'the page'], ['plugins', 'the plugin surfaces']]);
    const take = (member: string, what: string) => {
        const prev = seen.get(member);
        if (prev) {
            diagnostics.push({rule: 'generate', severity: 'error', at: what, message: `App's ${what} and ${prev} would both be "${member}".`, fix: 'Rename the scope, or the page in pageNames.'});
            return false;
        }
        seen.set(member, what);
        return true;
    };
    const scopes = model.topLevel.filter((s) => take(scopeAccessor(s), `scope ${s}`)).map((scope) => ({scope, member: scopeAccessor(scope)}));
    const pages = Object.keys(model.report.pages).sort(cmp).filter((p) => model.exported.get(p) === 'pages' && take(pageGetter(p), `page ${p}`)).map((page) => ({page, member: pageGetter(page)}));
    return {scopes, pages};
}
