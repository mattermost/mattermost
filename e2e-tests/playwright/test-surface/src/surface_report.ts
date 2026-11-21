// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {cmp} from './compare.ts';
import type {Config} from './config.ts';
import {camel, pascal, RESERVED_MEMBERS, roleWord} from './generate/names.ts';
import {isGrammarError, KEY_PLACEHOLDER} from './grammar.ts';
import type {Element, KeyInfo, ManifestOperation} from './manifest_types.ts';
import {CONTAINER, type Bind, type Family, type Key, type Mount, type Part, type SurfaceReport} from './report_types.ts';
import type {ScanResult, Emission} from './scan.ts';

type ParsedEmission = Emission & {parsed: Exclude<Emission['parsed'], {rule: string}>};

/** Converts scan provenance into the stable, path-free contract consumed by the page-object generator. */
class SurfaceReportError extends Error {}

export function buildSurfaceReport(result: ScanResult, config: Config): SurfaceReport {
    try {
        return reportFromScan(result, config);
    } catch (error) {
        if (!(error instanceof SurfaceReportError)) {
            throw error;
        }
        result.diagnostics.push({rule: 'collisions', severity: 'error', at: config.configPath, message: error.message});
        return {version: 4, families: {}, scopes: {}, operations: {}, sets: {}, pages: {}, pluginSlots: {}};
    }
}

function reportFromScan(result: ScanResult, config: Config): SurfaceReport {
    const manifest = result.manifest;
    const hasKeyOrigin = (element: Element) => !element.key || ['id', 'set', 'number'].includes(element.key.kind) || (element.key.kind === 'entity' && Boolean(element.key.entity && element.key.field && element.key.module));
    const elements = new Map(manifest.elements.filter(hasKeyOrigin).map((element) => [element.template, element]));
    const scopes = new Set<string>();
    const candidates = new Map<string, Map<string, number>>();
    const componentCandidates = new Map<string, Map<string, number>>();
    const declarations = new Map<string, Set<string>>();
    const scopeHasLiteralMember = new Set<string>();
    const topScopesWithMembers = new Set<string>();
    const elementsByScope = new Map<string, Element[]>();
    for (const element of elements.values()) {
        if (!element.grammar || element.unreachable || !generated(element, config)) {
            continue;
        }
        const direct = element.scope.join('.') || element.name;
        const container = [...element.scope, element.name].join('.');
        for (const scope of new Set([direct, container])) {
            const members = elementsByScope.get(scope) ?? [];
            members.push(element);
            elementsByScope.set(scope, members);
        }
    }

    for (const emission of result.emissions) {
        if (isGrammarError(emission.parsed)) {
            continue;
        }
        const scannedElement = elements.get(emission.template);
        if (!scannedElement || scannedElement.unreachable || !generated(scannedElement, config)) {
            continue;
        }
        const e = emission as ParsedEmission;
        const parsed = e.parsed;
        const scope = parsed.scope.length ? parsed.scope.join('.') : parsed.name;
        for (const prefix of prefixes(scope)) {
            scopes.add(prefix);
        }
        if (e.parsed.scope.length) {
            topScopesWithMembers.add(e.parsed.scope[0]);
        }
        if (!result.scopeOwnerAt(scope, e.via)) {
            scopeHasLiteralMember.add(scope);
        }
        const owner = result.scopeOwnerAt(scope, e.via) ?? e.site.ownerName;
        const ranked = candidates.get(scope) ?? new Map<string, number>();
        ranked.set(owner, (ranked.get(owner) ?? 0) + 1);
        candidates.set(scope, ranked);
        if (result.scopeOwnerAt(scope, e.via)) {
            const declaration = result.scopeOwnerAt(scope, e.via, true)!;
            declarations.set(scope, new Set([...(declarations.get(scope) ?? []), declaration]));
            const componentRanked = componentCandidates.get(scope) ?? new Map<string, number>();
            componentRanked.set(owner, (componentRanked.get(owner) ?? 0) + 1);
            componentCandidates.set(scope, componentRanked);
        }
    }

    // Literal members alongside a component's declarations give the scope its own family.
    const componentScopes = new Set([...scopes].filter((scope) => {
        const owners = candidates.get(scope);
        return owners?.size === 1 && declarations.get(scope)?.size === 1 && componentCandidates.get(scope)?.size === 1 && !scopeHasLiteralMember.has(scope);
    }));
    for (const scope of scopes) {
        if (!scope.includes('.') && !topScopesWithMembers.has(scope)) {
            scopes.delete(scope);
        }
    }
    const ownerFor = new Map<string, string>();
    for (const scope of scopes) {
        const source = componentCandidates.get(scope) ?? candidates.get(scope);
        const owner = [...(source ?? [])].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))[0]?.[0] ?? scope;
        ownerFor.set(scope, owner);
    }

    const childrenByScope = new Map<string, string[]>();
    for (const scope of scopes) {
        const parent = scope.slice(0, scope.lastIndexOf('.'));
        if (scope.includes('.')) {
            const children = childrenByScope.get(parent) ?? [];
            children.push(scope);
            childrenByScope.set(parent, children);
        }
    }

    const rolesByDeclaration = new Map<string, Map<string, Set<string>>>();
    for (const scope of componentScopes) {
        if (!scopes.has(scope)) {
            continue;
        }
        const declaration = [...declarations.get(scope)!][0];
        const roles = rolesByDeclaration.get(declaration) ?? new Map<string, Set<string>>();
        for (const element of elementsByScope.get(scope) ?? []) {
            if (!element.grammar || element.unreachable || !generated(element, config)) {
                continue;
            }
            const own = [...element.scope, element.name].join('.') === scope;
            if (own || element.scope.join('.') === scope) {
                const name = own ? CONTAINER : element.name;
                roles.set(name, new Set([...(roles.get(name) ?? []), `${element.role ?? ''}:${name === CONTAINER ? false : Boolean(element.portal)}:${element.native ?? ''}`]));
            }
        }
        rolesByDeclaration.set(declaration, roles);
    }
    for (const scope of componentScopes) {
        const roles = rolesByDeclaration.get([...declarations.get(scope)!][0]);
        if (roles && [...roles.values()].some((variants) => variants.size > 1)) {
            componentScopes.delete(scope);
        }
    }

    const renderedByScope = new Map<string, Set<string>>();
    for (const element of elements.values()) {
        if (element.renders?.length) {
            const scope = [...element.scope, element.name].join('.');
            renderedByScope.set(scope, new Set([...(renderedByScope.get(scope) ?? []), ...element.renders]));
        }
    }

    // A shared family exposes the same child families and rendered scopes at every mount.
    let split = true;
    while (split) {
        split = false;
        const signatures = new Map<string, Set<string>>();
        for (const scope of componentScopes) {
            if (!scopes.has(scope)) {
                componentScopes.delete(scope);
                continue;
            }
            const children = (childrenByScope.get(scope) ?? []);
            const childSignature = children.sort(cmp).map((child) => `${child.slice(scope.length + 1)}:${componentScopes.has(child) ? config.familyNames[child] ?? config.familyNames[ownerFor.get(child)!] ?? [...declarations.get(child)!][0] : child}`).join('|');
            const renderedSignature = [...(renderedByScope.get(scope) ?? [])].sort(cmp).join(',');
            const signature = `${childSignature}|renders:${renderedSignature}`;
            const owner = [...declarations.get(scope)!][0];
            signatures.set(owner, new Set([...(signatures.get(owner) ?? []), signature]));
        }
        for (const scope of componentScopes) {
            if ((signatures.get([...declarations.get(scope)!][0])?.size ?? 0) > 1) {
                componentScopes.delete(scope);
                split = true;
            }
        }
    }
    const familyFor = new Map<string, string>();
    const usedNames = new Map<string, string>();
    for (const scope of [...scopes].sort(cmp)) {
        const owner = ownerFor.get(scope)!;
        const isComponentFamily = componentScopes.has(scope);
        const identity = isComponentFamily ? owner : scope;
        const preferred = config.familyNames[scope] ?? config.familyNames[identity] ?? pascal(identity.replaceAll('.', '_'));
        const declaration = isComponentFamily ? [...declarations.get(scope)!][0] : scope;
        const previous = usedNames.get(preferred);
        if (previous && previous !== declaration) {
            let literalScope: string | undefined;
            if (scopes.has(previous) && !componentScopes.has(previous)) {
                literalScope = previous;
            } else if (!isComponentFamily) {
                literalScope = scope;
            }
            const suggestion = literalScope ? JSON.stringify({familyNames: {[literalScope]: preferred + 's'}}) : 'a scope-specific familyNames entry';
            throw new SurfaceReportError(`Family name "${preferred}" is used by both "${previous}" and "${owner}"; set ${suggestion} in the surface config.`);
        }
        usedNames.set(preferred, declaration);
        familyFor.set(scope, preferred);
    }

    const families: SurfaceReport['families'] = {};
    const mounts: SurfaceReport['scopes'] = {};
    const membersByScope = new Map<string, Map<string, Element>>();
    for (const scope of [...scopes].sort(cmp)) {
        const familyOwner = ownerFor.get(scope);
        const parts = new Map<string, Element>();
        const partSources = new Map<string, Set<string>>();
        const invalidRoles = new Set<string>();
        for (const element of elementsByScope.get(scope) ?? []) {
            if (!element.grammar || element.unreachable || !generated(element, config)) {
                continue;
            }
            const elementScope = element.scope.join('.');
            const directScope = elementScope || element.name;
            const containerScope = [...element.scope, element.name].join('.');
            if (directScope !== scope && containerScope !== scope) {
                continue;
            }
            const name = containerScope === scope ? CONTAINER : element.name;
            const sources = partSources.get(name) ?? new Set<string>();
            sources.add(element.component.name);
            partSources.set(name, sources);
            const previous = parts.get(name);
            if (previous && (previous.role !== element.role || previous.native !== element.native)) {
                result.diagnostics.push({rule: 'collisions', severity: 'error', at: element.component.at, template: element.template, message: previous.component.name === element.component.name ? `Scope "${scope}" part "${name}" is rendered as --${previous.role} and as --${element.role}: give each its own name, a testid must not change with state.` : `Scope "${scope}" part "${name}" has multiple roles; pass a static role prop at each mount so its testid does not change with state.`});
                invalidRoles.add(name);
                parts.delete(name);
            }
            if (invalidRoles.has(name)) {
                continue;
            }
            parts.set(name, element);
        }
        membersByScope.set(scope, parts);
        const familyParts: Record<string, Part> = {};
        let container: Part | undefined;
        const bind: Bind = {};
        for (const [name, element] of [...parts].sort((a, b) => cmp(a[0], b[0]))) {
            const p = partOf(element, familyOwner);
            if ((partSources.get(name)?.size ?? 0) > 1) {
                delete p.source;
            }
            if (name === CONTAINER) {
                if (element.native) {
                    result.diagnostics.push({rule: 'collisions', severity: 'error', at: element.component.at, template: element.template, message: 'A native file input cannot be a scope container; address it as a part of its item.'});
                }

                // The container's lookup root belongs to the mount, not to the shared family.
                delete p.portal;
                container = p;
            } else {
                familyParts[name] = p;
            }
        }

        const children: Record<string, {family: string; key?: Key | {kind: 'mount'}}> = {};
        for (const childScope of (childrenByScope.get(scope) ?? []).sort(cmp)) {
            const childName = childScope.slice(scope.length + 1);
            const childElement = parts.get(childName);
            const child = {family: familyFor.get(childScope)!, ...(childElement?.key ? {key: keyOf(childElement.key)} : {})};
            children[childName] = child;
            delete familyParts[childName];
            if (childElement) {
                delete bind[childName];
            }
        }

        const renders = [...new Set(parts.get(CONTAINER)?.renders ?? [])].filter((rendered) => scopes.has(rendered)).sort(cmp);
        const family: Family = {
            ...(container ? {container} : {}),
            ...(Object.keys(familyParts).length ? {parts: familyParts} : {}),
            ...(Object.keys(children).length ? {children} : {}),
            ...(renders.length ? {renders} : {}),
            ...(familyOwner && familyOwner !== familyFor.get(scope) && candidates.has(scope) && familyOwner !== '(anonymous)' ? {source: familyOwner} : {}),
        };
        const familyName = familyFor.get(scope)!;
        const previousFamily = families[familyName];
        families[familyName] = previousFamily ? mergeFamily(previousFamily, family) : family;
        const cleanedBind = cleanBind(bind);
        const mount: Mount = {family: familyFor.get(scope)!, ...(parts.get(CONTAINER)?.portal ? {portal: true} : {}), ...(Object.keys(cleanedBind).length ? {bind: cleanedBind} : {})};
        mounts[scope] = mount;
    }

    const scopesByFamily = new Map<string, string[]>();
    for (const [scope, mount] of Object.entries(mounts)) {
        scopesByFamily.set(mount.family, [...(scopesByFamily.get(mount.family) ?? []), scope]);
    }
    for (const [familyName, mountedScopes] of scopesByFamily) {
        const family = families[familyName];
        for (const [partName, part] of Object.entries(family.parts ?? {})) {
            const keyed = mountedScopes.map((scope) => membersByScope.get(scope)?.get(partName)).filter((element): element is Element => Boolean(element));
            const keys = keyed.map((element) => (element.key ? JSON.stringify(keyOf(element.key)) : ''));
            if (keys.includes('') && keys.some(Boolean)) {
                throw new SurfaceReportError(`Family ${familyName} part ${partName} is keyed at only some mounts; split the literal scope family.`);
            }
            if (new Set(keys).size > 1 && keys.every(Boolean)) {
                part.key = {kind: 'mount'};
            }
        }
        for (const [childName, child] of Object.entries(family.children ?? {})) {
            const keys = mountedScopes.map((scope) => membersByScope.get(scope)?.get(childName)?.key).map((key) => (key ? JSON.stringify(keyOf(key)) : ''));
            if (new Set(keys).size > 1 && keys.every(Boolean)) {
                child.key = {kind: 'mount'};
            }
        }
        for (const scope of mountedScopes) {
            const mount = mounts[scope];
            const bind: Bind = {...mount.bind};
            const present = membersByScope.get(scope)!;
            for (const partName of Object.keys(family.parts ?? {})) {
                const element = present.get(partName);
                if (!element) {
                    bind[partName] = false;
                } else if (family.parts?.[partName].key?.kind === 'mount' && element.key) {
                    bind[partName] = {...(bind[partName] === false ? {} : bind[partName]), key: keyOf(element.key) as Key};
                }
            }
            for (const [childName, child] of Object.entries(family.children ?? {})) {
                const element = present.get(childName);
                if (!scopes.has(scope + '.' + childName)) {
                    throw new SurfaceReportError(`Family ${familyName} has child ${childName} at only some mounts; split the literal scope family.`);
                }
                if (child.key?.kind === 'mount' && element?.key) {
                    bind[childName] = {key: keyOf(element.key) as Key};
                }
            }
            const cleaned = cleanBind(bind);
            mounts[scope] = {...mount, ...(Object.keys(cleaned).length ? {bind: cleaned} : {})};
        }
    }

    // A family is shared only when its mounts have the same generated members and child families.
    validateSharedFamilies(families, mounts);

    const operations: SurfaceReport['operations'] = {};
    for (const operation of result.allOperations) {
        operations[operation.opId] = operationOf(operation);
    }
    const sets = Object.fromEntries(manifest.sets.map((set) => [set.name, [...set.values].sort(cmp)]));
    const pages: SurfaceReport['pages'] = {};
    for (const page of manifest.pages) {
        pages[page.class] = {
            path: page.path,
            ...(page.params.length ? {params: page.params.map((param) => ({name: param.name, ...(param.as === param.name ? {} : {as: param.as}), ...(param.optional ? {optional: true as const} : {}), ...(param.values ? {values: param.values} : {}), ...(param.entity ? {entity: {type: param.entity.type, field: param.entity.field, from: param.entity.module}} : {}), ...(param.section ? {section: true as const} : {})}))} : {}),
            scopes: page.scopes.filter((scope) => scope in mounts).sort(cmp),
            ...(page.ready?.length ? {ready: [...page.ready]} : {}),
            source: page.component.name,
        };
    }
    const pluginSlots = Object.fromEntries(manifest.pluginSlots.map((slot) => [slot.slot, slot.template.replaceAll(KEY_PLACEHOLDER, '{key}')]));
    const plugin = manifest.plugin ? {
        id: manifest.plugin.id,
        scope: manifest.plugin.scope,
        slots: [...new Set(manifest.plugin.slotsUsed.flatMap((used) => used.slots))].sort(cmp),
    } : undefined;
    for (const name of Object.keys(sets)) {
        if (families[name] || pages[name]) {
            result.diagnostics.push({rule: 'collisions', severity: 'error', at: config.configPath, message: `Set "${name}" shares its exported name with a family or page.`, fix: `Set setNames[${JSON.stringify(name)}] to a distinct name.`});
        }
    }
    for (const [familyName, family] of Object.entries(families)) {
        const scope = Object.keys(mounts).find((name) => mounts[name].family === familyName)!;
        const members = [
            ...Object.entries(family.parts ?? {}).map(([word, part]) => ({word, member: camel(word) + (part.key ? '' : roleWord(part.role))})),
            ...Object.keys(family.children ?? {}).map((word) => ({word, member: camel(word)})),
        ];
        for (const {word, member} of members) {
            if (RESERVED_MEMBERS.has(member)) {
                result.diagnostics.push({rule: 'collisions', severity: 'error', at: scope, template: scope + '.' + word, message: `Part or child "${word}" of ${familyName} generates "${member}", which the runtime's Scope reserves.`, fix: 'Rename the testid word to describe what it renders.'});
            }
        }
    }
    return {version: 4, families, scopes: mounts, operations, sets, pages, pluginSlots, ...(plugin ? {plugin} : {})};
}

function prefixes(scope: string): string[] {
    const words = scope.split('.');
    return words.map((_, i) => words.slice(0, i + 1).join('.'));
}

function generated(element: Element, config: Config): boolean {
    const inScopes = config.generateScopes?.some((scope) => element.template === scope || element.template.startsWith(scope + '.') || element.template.startsWith(scope + ':') || element.template.startsWith(scope + '--'));
    const migrated = config.checks.strictPaths.some((prefix) => element.component.at.startsWith(prefix) || element.alsoAt?.some((at) => at.startsWith(prefix)) || element.instances.some((instance) => instance.via.some((via) => via.startsWith(prefix))));
    return (!config.generateScopes && !config.checks.strictPaths.length) || Boolean(inScopes || migrated);
}

function partOf(element: Element, familyOwner?: string): Part {
    const part: Part = {role: element.role, ...(element.native ? {native: element.native} : {})};
    if (element.portal) {
        part.portal = true;
    }
    if (element.key) {
        part.key = keyOf(element.key);
    }
    if (element.renderedWhen?.length) {
        part.conditional = true;
    }
    if (element.component.name && element.component.name !== familyOwner) {
        // Stable component names are useful only when they alter the generated API; omit the common case.
        part.source = element.component.name;
    }
    return part;
}

function keyOf(info: KeyInfo): Key | {kind: 'mount'} {
    switch (info.kind) {
    case 'set': return {kind: 'set', set: info.set ?? info.type};
    case 'number': return {kind: 'index'};
    case 'entity':
        if (info.entity && info.field && info.module) {
            return {kind: 'id', entity: info.entity, field: info.field, from: info.module};
        }
        throw new SurfaceReportError('Entity key has no importable entity identity.');
    case 'id': return {kind: 'id', value: info.value ?? 'key'};
    default: throw new SurfaceReportError('Key has no strict id, set or index origin.');
    }
}

function cleanBind(bind: Bind): Bind {
    const out: Bind = {};
    for (const [name, value] of Object.entries(bind)) {
        if (!value || Object.keys(value).length) {
            out[name] = value;
        }
    }
    return out;
}

function operationOf(operation: Pick<ManifestOperation, 'opId' | 'verb' | 'path' | 'body' | 'bodyImports'>): SurfaceReport['operations'][string] {
    const method = operation.verb.toUpperCase();
    const allowed = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
    if (!allowed.has(method)) {
        throw new SurfaceReportError(`Operation ${operation.opId} has unsupported method ${method}.`);
    }
    return {method: method as SurfaceReport['operations'][string]['method'], path: operation.path, body: operation.body, ...(operation.bodyImports ? {imports: operation.bodyImports} : {})};
}

function validateSharedFamilies(families: Record<string, Family>, mounts: Record<string, Mount>) {
    for (const [scope, mount] of Object.entries(mounts)) {
        const family = families[mount.family];
        if (!family) {
            throw new SurfaceReportError(`Scope ${scope} names missing family ${mount.family}.`);
        }
    }
}

function mergeFamily(a: Family, b: Family): Family {
    if (a.container && b.container && (a.container.role !== b.container.role || a.container.native !== b.container.native)) {
        throw new SurfaceReportError(`Family container has different roles at its mounts (${a.container.role}, ${b.container.role}); set scope-specific familyNames to keep their drivers distinct.`);
    }
    for (const [name, part] of Object.entries(b.parts ?? {})) {
        const previous = a.parts?.[name];
        if (previous && (previous.role !== part.role || previous.native !== part.native)) {
            throw new SurfaceReportError(`Family part ${name} has different roles at its mounts (${previous.role}, ${part.role}); set scope-specific familyNames to keep their drivers distinct.`);
        }
    }
    for (const [name, child] of Object.entries(b.children ?? {})) {
        const previous = a.children?.[name];
        if (previous && previous.family !== child.family) {
            throw new SurfaceReportError(`A family has child ${name} mounted as different families (${previous.family}, ${child.family}); configure separate literal families.`);
        }
    }
    const parts = {...a.parts};
    for (const [name, part] of Object.entries(b.parts ?? {})) {
        parts[name] = parts[name] ? mergePart(parts[name], part) : part;
    }
    const children = {...a.children, ...b.children};
    const container = a.container && b.container ? mergePart(a.container, b.container) : a.container ?? b.container;
    return {
        ...(container ? {container} : {}),
        ...(Object.keys(parts).length ? {parts} : {}),
        ...(Object.keys(children).length ? {children} : {}),
        ...(a.renders || b.renders ? {renders: [...new Set([...(a.renders ?? []), ...(b.renders ?? [])])].sort(cmp)} : {}),
        ...(a.source && a.source === b.source ? {source: a.source} : {}),
    };
}

function mergePart(a: Part, b: Part): Part {
    const merged: Part = {...a, ...b};
    if (a.conditional || b.conditional) {
        merged.conditional = true;
    }
    if (a.portal || b.portal) {
        merged.portal = true;
    }
    if (a.source !== b.source) {
        delete merged.source;
    }
    return merged;
}
