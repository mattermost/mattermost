// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ts from 'typescript';

import type {FileName} from './model.ts';
import {pascal} from './names.ts';

import {cmp} from '../compare.ts';

/** Marks a package type until the file is complete and its local name can be chosen (no generated code holds it). */
const TYPE_MARK = '\u0000';

/**
 * What one generated file imports, rendered in a fixed order: Playwright, entity types, the runtime, sibling files.
 *
 * A package type is named once the whole file is known (`finish`): two modules can export types of one name (`Record`),
 * and a package type can share a name with a runtime or sibling import or with something the file declares. The first
 * module of a name, in module order, keeps it; the others, and any that clash, import under an alias
 * (`Record as Record_Recaps`). The choice depends only on the file's contents, never on the order of the calls.
 */
export class Imports {
    private readonly file: FileName;
    private readonly runtime: string;
    private readonly playwright = new Set<string>();
    private readonly modules = new Map<string, Set<string>>();
    private readonly runtimeValues = new Set<string>();
    private readonly runtimeTypes = new Set<string>();
    private readonly siblingValues = new Map<FileName, Set<string>>();
    private readonly siblingTypes = new Map<FileName, Set<string>>();

    constructor(file: FileName, runtime: string) {
        this.file = file;
        this.runtime = runtime;
    }

    page(): string {
        this.playwright.add('Page');
        return 'Page';
    }

    locator(): string {
        this.playwright.add('Locator');
        return 'Locator';
    }

    /** A type from a package (`Recap` from `@mattermost/types/recaps`): a placeholder that `finish` names. */
    type(name: string, module: string): string {
        add(this.modules, module, name);
        return `${TYPE_MARK}${module}${TYPE_MARK}${name}${TYPE_MARK}`;
    }

    /**
     * The file's import block and its body, with each package type named: `body` is the code using the placeholders
     * `type` returned. Every generated file that imports a package type is put together through here.
     */
    finish(body: string): {imports: string; body: string} {
        const local = this.typeNames(body);
        const named = body.replace(new RegExp(`${TYPE_MARK}([^${TYPE_MARK}]*)${TYPE_MARK}([^${TYPE_MARK}]*)${TYPE_MARK}`, 'g'), (_, module: string, name: string) => local.get(`${module}\n${name}`)!);
        return {imports: this.render(local), body: named};
    }

    /** The local name of each package type (`module\nname` -> name), against everything else the file names. */
    private typeNames(body: string): Map<string, string> {
        const taken = new Set<string>([...this.playwright, ...this.runtimeValues, ...this.runtimeTypes]);
        for (const names of [...this.siblingValues.values(), ...this.siblingTypes.values()]) {
            names.forEach((n) => taken.add(n));
        }
        declaredNames(body).forEach((name) => taken.add(name));
        const byName = new Map<string, string[]>();
        for (const [module, names] of this.modules) {
            for (const name of names) {
                byName.set(name, [...(byName.get(name) ?? []), module]);
            }
        }
        const local = new Map<string, string>();
        for (const name of [...byName.keys()].sort(cmp)) {
            for (const [index, module] of byName.get(name)!.sort(cmp).entries()) {
                let chosen = name;
                if (index > 0 || taken.has(name)) {
                    const base = `${name}_${pascal(module.split('/').pop()!.replace(/[^A-Za-z0-9_]/g, '_')) || 'Module'}`;
                    chosen = base;
                    for (let n = 2; taken.has(chosen); n++) {
                        chosen = `${base}${n}`;
                    }
                }
                taken.add(chosen);
                local.set(`${module}\n${name}`, chosen);
            }
        }
        return local;
    }

    value(name: string): string {
        this.runtimeValues.add(name);
        return name;
    }

    rt(name: string): string {
        this.runtimeTypes.add(name);
        return name;
    }

    /** A name another generated file exports, used as a value (a class, a constant). */
    sibling(name: string, file: FileName): string {
        if (file !== this.file) {
            add(this.siblingValues, file, name);
        }
        return name;
    }

    /** A name another generated file exports, used only in types. */
    siblingType(name: string, file: FileName): string {
        if (file !== this.file) {
            add(this.siblingTypes, file, name);
        }
        return name;
    }

    /** The import block; package types under the local names `finish` chose (their own names when called alone). */
    render(local = this.typeNames('')): string {
        const blocks: string[][] = [[], [], []];
        if (this.playwright.size) {
            blocks[0].push(`import type {${sorted(this.playwright).join(', ')}} from '@playwright/test';`);
        }
        for (const [module, names] of [...this.modules].sort((a, b) => cmp(a[0], b[0]))) {
            const specifiers = sorted(names).map((name) => {
                const as = local.get(`${module}\n${name}`) ?? name;
                return as === name ? name : `${name} as ${as}`;
            });
            blocks[0].push(`import type {${specifiers.join(', ')}} from '${module}';`);
        }
        const rtTypes = sorted(this.runtimeTypes).filter((t) => !this.runtimeValues.has(t));
        if (this.runtimeValues.size) {
            blocks[1].push(`import {${[...sorted(this.runtimeValues), ...rtTypes.map((t) => `type ${t}`)].join(', ')}} from '${this.runtime}';`);
        } else if (rtTypes.length) {
            blocks[1].push(`import type {${rtTypes.join(', ')}} from '${this.runtime}';`);
        }
        const files = new Set([...this.siblingValues.keys(), ...this.siblingTypes.keys()]);
        for (const file of [...files].sort(cmp)) {
            const values = sorted(this.siblingValues.get(file) ?? new Set());
            const types = sorted(this.siblingTypes.get(file) ?? new Set()).filter((t) => !values.includes(t));
            const names = [...values, ...types.map((t) => `type ${t}`)];
            blocks[2].push(values.length ? `import {${names.join(', ')}} from './${file}';` : `import type {${types.join(', ')}} from './${file}';`);
        }
        return blocks.filter((b) => b.length).map((b) => b.join('\n')).join('\n\n');
    }
}

/**
 * Every name the generated code declares, type parameters included (`B` of `Family<in out B extends …>`): a package type
 * of that name would be shadowed by it. Read from the code's syntax, with each placeholder standing in as an identifier.
 */
function declaredNames(body: string): Set<string> {
    const source = ts.createSourceFile('generated.ts', body.replace(new RegExp(`${TYPE_MARK}[^${TYPE_MARK}]*${TYPE_MARK}[^${TYPE_MARK}]*${TYPE_MARK}`, 'g'), '__PackageType'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    const names = new Set<string>();
    const visit = (node: ts.Node) => {
        if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isEnumDeclaration(node) || ts.isTypeParameterDeclaration(node)) && node.name) {
            names.add(node.name.text);
        } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            names.add(node.name.text);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return names;
}

/**
 * A type's text with each reference to one of `names` replaced: only where the type syntax refers to a type by name
 * (`Record`, `Record[]`, `Pick<Record, 'id'>`, `typeof x`'s root is left alone), never in a string literal or a
 * property name (`{kind: 'Record'; 'Record': Record}` changes only its last `Record`).
 */
export function renameTypeReferences(text: string, names: ReadonlyMap<string, string>): string {
    const prefix = 'type __T = ';
    const source = ts.createSourceFile('type.ts', `${prefix}${text};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const edits: Array<{start: number; end: number; name: string}> = [];
    const visit = (node: ts.Node) => {
        if (ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node)) {
            let root: ts.Node = ts.isTypeReferenceNode(node) ? node.typeName : node.expression;
            while (ts.isQualifiedName(root) || ts.isPropertyAccessExpression(root)) {
                root = ts.isQualifiedName(root) ? root.left : root.expression;
            }
            if (ts.isIdentifier(root) && names.has(root.text)) {
                edits.push({start: root.getStart(source) - prefix.length, end: root.getEnd() - prefix.length, name: names.get(root.text)!});
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    let out = text;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
        out = out.slice(0, edit.start) + edit.name + out.slice(edit.end);
    }
    return out;
}

function add<K>(map: Map<K, Set<string>>, key: K, name: string) {
    const s = map.get(key) ?? new Set<string>();
    s.add(name);
    map.set(key, s);
}

function sorted(s: Set<string>): string[] {
    return [...s].sort(cmp);
}
