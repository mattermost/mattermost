// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Imports} from './imports.ts';
import {bindingType, mountConst, mountType, type FamilyModel, type Member, type Model} from './model.ts';
import {camel, docText, paramName, str} from './names.ts';

import {CONTAINER, type Key, type Part} from '../report_types.ts';
import {ROLE_TABLE} from '../role_table.ts';

/**
 * A family's binding constraint and its class: one getter or method per member, each with its return type written out,
 * and every runtime helper called with explicit type arguments (inference would read `this.bind.x` as the constraint's
 * type and lose the mount).
 */
export function emitFamily(model: Model, f: FamilyModel, imp: Imports): string {
    const out = [bindingDecl(model, f, imp)];
    if (f.form) {
        out.push(formTypes(f));
    }
    if (f.row) {
        out.push(`/** The text parts of one \`${f.name}\` item (\`null\` where one isn't rendered). */\nexport type ${f.name}Texts = {\n${f.row.map((m) => `    ${camel(m.name)}: string | null;`).join('\n')}\n};`);
    }
    const B = bindingType(f.name);
    const body = [
        ...f.members.map((m) => member(model, f, m, imp)),
        ...(f.form ? formMethods(f, imp) : []),
        ...(f.row ? [rowRead(f, imp)] : []),
    ];
    imp.value('Scope');
    const where = f.mounts.length ? `: mounted at ${f.mounts.map((m) => `\`${m}\``).join(', ')}` : '';
    out.push(`/** \`${f.name}\`${docText(where)}. */
export class ${f.name}<in out B extends ${B}> extends Scope<B> {
${body.map(indent).join('\n\n')}
}`);
    return out.join('\n\n');
}

function bindingDecl(model: Model, f: FamilyModel, imp: Imports): string {
    const lines = f.bindingNames.map((name) => {
        const child = f.family.children?.[name];
        if (!child) {
            // a part keyed by its mount: the mount says what the key is, and whether it is a position
            return f.family.parts?.[name]?.key?.kind === 'mount' ? `    ${name}: ${imp.rt('Keyed')}<string | number, Exclude<${imp.rt('PartBinding')}, false>> | false;` : `    ${name}: ${imp.rt('PartBinding')};`;
        }
        const target = model.families.get(child.family)!;
        const t = imp.siblingType(bindingType(child.family), target.file);
        return `    ${name}: ${child.key?.kind === 'mount' ? `${imp.rt('Keyed')}<string | number, ${t}>` : t};`;
    });
    return `export type ${bindingType(f.name)} = {\n${lines.join('\n')}\n};`;
}

const roleArg = (part: Pick<Part, 'role'>) => (part.role ? str(part.role) : 'null');
function sourceOf(f: FamilyModel, part?: Part): string {
    return part?.source ?? f.family.source ?? f.name;
}

/**
 * A runtime helper's options, as a trailing argument: `portal`; `source`, the component failures name, when it isn't the
 * class name (a literal family's class is named after its scope); `index`, so a position-keyed list's `keys()` are numbers.
 */
function opts(o: {portal?: boolean; source?: string; className?: string; index?: boolean | string}): string {
    const index = typeof o.index === 'string' ? [`index: ${o.index}`] : [];
    const entries = [
        ...(o.portal ? ['portal: true'] : []),
        ...(o.source && o.source !== o.className ? [`source: ${str(o.source)}`] : []),
        ...(o.index === true ? ['index: true'] : index),
    ];
    return entries.length ? `, {${entries.join(', ')}}` : '';
}

/** What a key is passed as, and the key type the runtime gets. */
function keyParam(key: Key | {kind: 'mount'}, name: string, imp: Imports): {generic: string; param: string; k: string; expr: string; list: string} {
    switch (key.kind) {
    case 'set': {
        const set = imp.siblingType(key.set, 'sets');
        return {generic: `<K extends ${set}>`, param: 'key: K', k: 'K', expr: 'key', list: set};
    }
    case 'id': {
        if ('value' in key) {
            const param = paramName(name);
            return {generic: '', param: `${param}: string`, k: 'string', expr: param, list: 'string'};
        }
        if (key.as) {
            const t = imp.type(key.as.type, key.as.from);
            return {generic: '', param: `key: ${t}`, k: t, expr: 'key', list: t};
        }
        imp.value('keyOf');
        const entity = imp.type(key.entity, key.from);
        return {generic: '', param: `key: Pick<${entity}, ${str(key.field)}> | string`, k: 'string', expr: `keyOf(key, ${str(key.field)})`, list: 'string'};
    }
    case 'index':
        return {generic: '', param: 'key: number', k: 'number', expr: 'key', list: 'number'};
    }

    // what the mount lists
    const k = `${imp.rt('KeyOf')}<B['${name}']>`;
    return {generic: `<K extends ${k}>`, param: 'key: K', k: 'K', expr: 'key', list: k};
}

/** Whether a list's keys are positions: fixed by the family, or read from the mount's binding. */
function listIndex(key: Key | {kind: 'mount'}, fromBinding: string): boolean | string {
    return key.kind === 'mount' ? fromBinding : key.kind === 'index';
}

function keyDoc(key: Key | {kind: 'mount'}): string {
    switch (key.kind) {
    case 'set':
        return `keyed by \`${key.set}\``;
    case 'id':
        if ('value' in key) {
            return `keyed by \`${key.value}\``;
        }
        return key.as ? `keyed by \`${key.as.type}\`` : `keyed by \`${key.entity}.${key.field}\``;
    case 'index':
        return 'keyed by position';
    }
    return 'keyed by what the mount lists';
}

function member(model: Model, f: FamilyModel, m: Member, imp: Imports): string {
    const driver = (role: string, p: string) => `${imp.rt('Part')}<${imp.rt('DriverFor')}<${role}>, ${p}>`;
    const cond = (part: Part) => (part.conditional ? ' Rendered only under a condition.' : '');
    switch (m.kind) {
    case 'container': {
        const R = roleArg(m.part);
        const tid = `<scope>${f.item ? ':{key}' : ''}${m.part.role ? `--${m.part.role}` : ''}`;
        return `/** \`${tid}\` (${sourceOf(f, m.part)}) */
get container(): ${driver(R, `B['${CONTAINER}']`)} {
    return this.own<${R}, B['${CONTAINER}']>(${R}, this.bind.${CONTAINER}${opts({source: sourceOf(f, m.part), className: f.name})});
}`;
    }
    case 'part': {
        if (m.part.native === 'file') {
            const P = `B['${m.name}']`;
            return `/** \`<scope>.${m.name}\` (${sourceOf(f, m.part)}): a native file input.${cond(m.part)} */
get ${m.member}(): ${imp.rt('Part')}<${imp.rt('FileInputDriver')}, ${P}> {
    return this.fileInput<${P}>(${str(m.name)}, this.bind.${m.name}${opts({portal: m.part.portal, source: sourceOf(f, m.part), className: f.name})});
}`;
        }
        const R = roleArg(m.part);
        return `/** \`<scope>.${m.name}${m.part.role ? `--${m.part.role}` : ''}\` (${sourceOf(f, m.part)}).${cond(m.part)} */
get ${m.member}(): ${driver(R, `B['${m.name}']`)} {
    return this.part<${R}, B['${m.name}']>(${str(m.name)}, ${R}, this.bind.${m.name}${opts({portal: m.part.portal, source: sourceOf(f, m.part), className: f.name})});
}`;
    }
    case 'keyedPart': {
        const R = roleArg(m.part);
        const k = keyParam(m.key, m.name, imp);
        const P = `B['${m.name}']`;
        const item = () => `${imp.rt('Part')}<${imp.rt('DriverFor')}<${R}>, ${P}>`;
        const list = `${imp.rt('Part')}<${imp.rt('KeyedList')}<${k.list}, ${item()}>, ${P}>`;
        const o = {portal: m.part.portal, source: sourceOf(f, m.part), className: f.name};
        return `/** \`<scope>.${m.name}:{key}${m.part.role ? `--${m.part.role}` : ''}\` (${sourceOf(f, m.part)}), ${keyDoc(m.key)}.${cond(m.part)} */
${m.member}${k.generic}(${k.param}): ${item()} {
    return this.keyed<${R}, ${P}, ${k.k}>(${str(m.name)}, ${R}, ${k.expr}, this.bind.${m.name}${opts(o)});
}

get ${m.list}(): ${list} {
    return this.partList<${k.list}, ${item()}, ${P}>(${str(m.name)}, ${R}, this.bind.${m.name}, (key: ${k.list}) => this.${m.member}(key)${opts({...o, index: listIndex(m.key, `this.bind.${m.name} === false ? undefined : this.bind.${m.name}.index`)})});
}`;
    }
    case 'child': {
        const target = model.families.get(m.child.family)!;
        const cls = imp.sibling(m.child.family, target.file);
        const T = `${cls}<B['${m.name}']>`;
        return `/** \`<scope>.${m.name}\`: ${m.child.family}${m.portal ? ', in a portal' : ''}. */
get ${m.member}(): ${T} {
    return new ${cls}(this.page, \`\${this.scope}.${m.name}\`, this.bind.${m.name}${m.portal ? '' : ', this.root'});
}`;
    }
    case 'keyedChild': {
        const target = model.families.get(m.child.family)!;
        const cls = imp.sibling(m.child.family, target.file);
        const R = roleArg(target.family.container ?? {role: null});
        const k = keyParam(m.key, m.name, imp);
        const T = `${cls}<B['${m.name}']>`;
        const param = m.key.kind === 'set' || m.key.kind === 'mount' ? `key: ${k.list}` : k.param;
        const o = {portal: m.portal, source: sourceOf(target, target.family.container), className: target.name};
        return `/** \`<scope>.${m.name}:{key}\`: ${m.child.family}, ${keyDoc(m.key)}${m.portal ? ', in a portal' : ''}. */
${m.member}(${param}): ${T} {
    const item = this.item(${str(m.name)}, ${R}, ${k.expr}${opts({portal: m.portal})});
    return new ${cls}(this.page, \`\${this.scope}.${m.name}\`, this.bind.${m.name}, item, item);
}

get ${m.list}(): ${imp.rt('KeyedList')}<${k.list}, ${T}> {
    return this.list<${k.list}, ${T}>(${str(m.name)}, ${R}, (key: ${k.list}) => this.${m.member}(key)${opts({...o, index: listIndex(m.key, `this.bind.${m.name}.index`)})});
}`;
    }
    default: {
        const mount = model.report.scopes[m.scope];
        const target = mount && model.families.get(mount.family);
        if (!target) {
            return `// \`${m.scope}\` is rendered here but has no family`;
        }
        const file = model.scopeFile.get(m.scope)!;
        const cls = imp.sibling(target.name, target.file);
        return `/** \`${m.scope}\`, rendered inside this element. */
get ${m.member}(): ${cls}<${imp.siblingType(mountType(m.scope), file)}> {
    return new ${cls}(this.page, ${str(m.scope)}, ${imp.sibling(mountConst(m.scope), file)}, this.locator);
}`;
    }
    }
}

const valueType = (m: Extract<Member, {kind: 'part'}>) => ROLE_TABLE[m.part.role!].value ?? 'string';
const field = (m: Extract<Member, {kind: 'part'}>) => m.name;

/** A field never rendered at a mount can't be filled there (`never`), and reads as `undefined`. */
function formTypes(f: FamilyModel): string {
    const B = bindingType(f.name);
    const form = f.form!;
    const values = form.fields.map((m) => `    ${field(m)}?: B['${m.name}'] extends false ? never : ${valueType(m)};`);
    const out = [`/** The form fields of \`${f.name}\`: \`fill()\` sets the given ones. */\nexport type ${f.name}FormValues<B extends ${B}> = {\n${values.join('\n')}\n};`];
    if (form.readable) {
        const reads = form.fields.map((m) => `    ${field(m)}: B['${m.name}'] extends false ? undefined : ${valueType(m)}${m.part.conditional ? ' | undefined' : ''};`);
        out.push(`/** What \`read()\` returns: a field that isn't rendered reads as \`undefined\`. */\nexport type ${f.name}FormRead<B extends ${B}> = {\n${reads.join('\n')}\n};`);
    }
    return out.join('\n\n');
}

function formMethods(f: FamilyModel, imp: Imports): string[] {
    const form = f.form!;
    const drv = (m: Extract<Member, {kind: 'part'}>) => `(this.${m.member} as ${imp.rt('DriverFor')}<${roleArg(m.part)}>)`;
    const fills = form.fields.map((m) => {
        const value = `values.${field(m)}`;
        const input = m.part.role === 'spinbutton' ? `String(${value})` : value;
        return `    if (${value} !== undefined) {
        await ${drv(m)}.${ROLE_TABLE[m.part.role!].fill}(${input});
    }`;
    });

    // Text fields are preparing actions; a checkbox, switch, toggle button or radio group's setter waits for the state
    // it sets. A combobox's choice is the one step the caller observes after fill().
    const out = [`/** Fills the given fields; the others are left as they are. */
async fill(values: ${f.name}FormValues<B>): Promise<void> {
${fills.join('\n')}
}`];
    if (form.readable) {
        // fields that always render first: by the time a conditional one is checked (without waiting) the form is up
        const ordered = [...form.fields.filter((m) => !m.part.conditional), ...form.fields.filter((m) => m.part.conditional)];
        const reads = ordered.map((m) => {
            const read = `await ${drv(m)}.${ROLE_TABLE[m.part.role!].read}()`;
            const present = m.part.conditional ? `(await ${drv(m)}.locator.count()) ? ${read} : undefined` : read;
            return `    const ${local(m)} = this.bind.${m.name} === false ? undefined : ${present};`;
        });
        out.push(`/** Reads every field. */
async read(): Promise<${f.name}FormRead<B>> {
${reads.join('\n')}
    return {${form.fields.map((m) => `${field(m)}: ${local(m)}`).join(', ')}} as ${f.name}FormRead<B>;
}`);
    }
    return out;
}

const local = (m: Extract<Member, {kind: 'part'}>) => `v${m.member.charAt(0).toUpperCase()}${m.member.slice(1)}`;

function rowRead(f: FamilyModel, imp: Imports): string {
    const texts = f.row!;
    const reads = texts.map((m) => `        ${camel(m.name)}: this.bind.${m.name} === false ? null : await (this.${m.member} as ${imp.rt('DriverFor')}<'text'>).textIfPresent(),`);
    return `/** Reads the item's text parts. */
async read(): Promise<${f.name}Texts> {
    return {
${reads.join('\n')}
    };
}`;
}

function indent(code: string): string {
    return code.split('\n').map((l) => (l ? `    ${l}` : l)).join('\n');
}
