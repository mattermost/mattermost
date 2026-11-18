// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {cmp} from '../compare.ts';
import {type Config} from '../config.ts';
import {pascal} from '../generate/names.ts';
import {type Diagnostic, type Element} from '../manifest_types.ts';
import {type Gap} from '../values.ts';

/** Both the import contract and its canonical declaration must agree across mounts. */
function entityIdentity(gap: Gap): string {
    return JSON.stringify([gap.entity, gap.field, gap.module ?? '', gap.entityIdentity ?? '']);
}

/**
 * The kinds of key a keyed testid gets across its mounts, when every origin is resolved: literal keys are a set (an index
 * when all are digits), an id by what it identifies, an entity by its field. Null when some origin is still an open
 * string, which the key-origin check reports on its own.
 */
export function keyKinds(values: Set<string>, gaps: Gap[]): Set<string> | null {
    const kinds = new Set<string>();
    if (values.size) {
        kinds.add([...values].every((value) => (/^\d+$/).test(value)) ? 'index' : 'set');
    }
    for (const gap of gaps) {
        if (gap.kind === 'set') {
            kinds.add('set');
        } else if (gap.kind === 'number') {
            kinds.add('index');
        } else if (gap.kind === 'id') {
            kinds.add(`id ${gap.value ?? gap.field ?? ''}`.trim());
        } else if (gap.kind === 'entity') {
            kinds.add(`${gap.entity}.${gap.field} ${entityIdentity(gap)}`);
        } else {
            return null;
        }
    }
    return kinds;
}

/**
 * Whether a keyed name's kinds are two identities rather than one written two ways: literals beside one id-by-value are
 * known keys of that id; two id-by-values are one identity only when their values are equal; an entity id beside
 * literals, and an index beside anything, are two.
 */
export function incompatibleKinds(kinds: Set<string>): boolean {
    const ids = [...kinds].filter((kind) => kind.startsWith('id '));
    const rest = [...kinds].filter((kind) => !kind.startsWith('id ') && kind !== 'set');
    if (ids.length === 1 && !rest.length) {
        return false;
    }
    return kinds.size > 1;
}

export function keyInfo(values: Set<string>, gaps: Gap[]): Element['key'] {
    const vals = [...values].sort();
    const kinds = new Set(gaps.map((g) => g.kind));
    if (!gaps.length || (kinds.size === 1 && kinds.has('set'))) {
        const all = [...new Set([...vals, ...gaps.flatMap((g) => g.values ?? [])])].sort();
        return {kind: 'set', type: all.map((v) => JSON.stringify(v)).join(' | ') || 'never', values: all};
    }
    if (kinds.size === 1 && kinds.has('id')) {
        const key = gaps.find((gap) => gap.kind === 'id');
        return {kind: 'id', value: key?.value ?? 'key', type: 'string', ...(vals.length ? {values: vals} : {})};
    }
    const entity = gaps.find((g) => g.kind === 'entity');
    if (entity && gaps.every((g) => g.kind === 'entity' && entityIdentity(g) === entityIdentity(entity))) {
        return {kind: 'entity', entity: entity.entity, field: entity.field, ...(entity.module ? {module: entity.module} : {}), type: `Pick<${entity.entity}, '${entity.field}'>`, ...(vals.length ? {values: vals} : {})};
    }
    if (kinds.size === 1 && kinds.has('number')) {
        return {kind: 'number', type: 'number', ...(vals.length ? {values: vals} : {})};
    }
    return {kind: 'string', type: 'string', ...(vals.length ? {values: vals} : {})};
}

/** Fixed key sets: one per keyed element with known key values (all of them, or the known part of an open key), named after its top scope and name. */
export function fixedSets(elements: Element[], config: Config, diagnostics: Diagnostic[]) {
    const sets = new Map<string, {name: string; values: string[]; source: string}>();
    for (const element of [...elements].sort((a, b) => cmp(a.template, b.template))) {
        if (!element.grammar || !element.key || !(element.key.kind === 'set' || element.key.kind === 'string') || !element.key.values?.length) {
            continue;
        }
        const path = [...element.scope, element.name].join('.');
        const derived = element.key.setSource ? pascal(element.key.setSource) : pascal(path.replaceAll('.', '_')) + 'Key';
        const name = config.setNames[path] ?? config.setNames[derived] ?? derived;
        const values = [...element.key.values].sort(cmp);
        const previous = sets.get(name);
        if (previous && JSON.stringify(previous.values) !== JSON.stringify(values)) {
            diagnostics.push({rule: 'collisions', severity: 'error', at: element.component.at, template: element.template, message: `Set "${name}" names different member sets.`, fix: `Set setNames[${JSON.stringify(path)}] to a distinct name.`});
            continue;
        }
        element.key.set = name;
        sets.set(name, {name, values, source: element.component.at});
    }
    return [...sets.values()].sort((a, b) => cmp(a.name, b.name));
}
