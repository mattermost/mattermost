// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Imports} from './imports.ts';
import {mountConst, mountType, type Model} from './model.ts';
import {propKey} from './names.ts';

import {CONTAINER, type Key, type PartBind} from '../report_types.ts';

/**
 * Mounts: per scope, the binding type and the constant, both written out in full. A part the mount says nothing about is
 * `{}`, one it never renders is `false`, a child is the child scope's own constant. A binding holds keys only.
 *
 * Constants refer by value only to constants in their own file (a child scope shares its parent's first word), so the
 * generated modules have no initialization cycle.
 */

type Shape = {type: string; value: string};

export class MountEmitter {
    private readonly model: Model;

    constructor(model: Model) {
        this.model = model;
    }

    /** The mount of `scope`: its binding type and constant. */
    emitMount(scope: string, imp: Imports): string {
        const mount = this.model.report.scopes[scope];
        const family = this.model.families.get(mount.family);
        if (!family) {
            return '';
        }
        const shape = this.shape(scope, imp);
        const T = mountType(scope);
        return `/** \`${scope}\`: a mount of ${mount.family}${mount.portal ? ', in a portal' : ''}. */
export type ${T} = ${shape.type};
export const ${mountConst(scope)}: ${T} = ${shape.value};`;
    }

    private shape(scope: string, imp: Imports): Shape {
        const mount = this.model.report.scopes[scope];
        const bind = mount.bind ?? {};
        const f = this.model.families.get(mount.family)!;
        const types: string[] = [];
        const values: string[] = [];
        for (const name of f.bindingNames) {
            const child = f.family.children?.[name];
            const pb = bind[name];
            if (child) {
                const at = `${scope}.${name}`;
                const file = this.model.scopeFile.get(at) ?? '';
                let t = imp.siblingType(mountType(at), file);
                if (child.key?.kind === 'mount' && pb && pb.key) {
                    t = `${imp.rt('Keyed')}<${this.keyType(pb.key, imp)}, ${t}>`;
                }
                types.push(`${propKey(name)}: ${t}`);

                // a key this mount gives as a position says so in the value, for the shared class's list to read
                const c = imp.sibling(mountConst(at), file);
                values.push(`${propKey(name)}: ${positional(child.key, pb) ? `{...${c}, index: true}` : c}`);
                continue;
            }
            const part = name === CONTAINER ? f.family.container : f.family.parts?.[name];
            if (pb === false) {
                types.push(`${propKey(name)}: false`);
                values.push(`${propKey(name)}: false`);
                continue;
            }
            types.push(`${propKey(name)}: ${part?.key?.kind === 'mount' && pb?.key ? `${imp.rt('Keyed')}<${this.keyType(pb.key, imp)}>` : '{}'}`);
            values.push(`${propKey(name)}: ${positional(part?.key, pb) ? '{index: true}' : '{}'}`);
        }
        return {type: block(types, ';'), value: block(values, ',')};
    }

    private keyType(key: Key, imp: Imports): string {
        switch (key.kind) {
        case 'set':
            return imp.siblingType(key.set, 'sets');
        case 'id':
            return key.as ? imp.type(key.as.type, key.as.from) : 'string';
        case 'index':
            return 'number';
        }
        return 'string';
    }
}

/** A member the family leaves the key to, whose key here is a position. */
function positional(familyKey: {kind: string} | undefined, pb: PartBind | false | undefined): boolean {
    return familyKey?.kind === 'mount' && Boolean(pb && pb.key?.kind === 'index');
}

/** A mount's own object: one member per line. */
function block(entries: string[], sep: ';' | ','): string {
    return entries.length ? `{\n${entries.map((e) => `    ${e}${sep}`).join('\n')}\n}` : '{}';
}
