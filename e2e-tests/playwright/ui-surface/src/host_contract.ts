// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import ts from 'typescript';

import {extractOpenApi} from './catalog.js';
import type {SurfaceReport} from './scan.js';

export type SlotEntry = {
    template: string;
    registry: string[];
    verified: boolean;
    host?: string;
    reason?: string;
};

export type RegistryMethod = {
    params: string[];
    returnType?: string;
};

export type HostContract = {
    schemaVersion: 1;
    mattermostVersion: string;
    slots: Record<string, SlotEntry>;
    api: Record<string, {method: string; path: string; params: string[]; responseRef?: string}>;
    registry: {
        methods: Record<string, RegistryMethod>;
        pluginTypes: string[];
    };
};

export type BreakingChange = {
    layer: 'slots' | 'api' | 'registry';
    symbol: string;
    reason: string;
};

function extractRegistryMethods(registryPath: string): Record<string, RegistryMethod> {
    const source = ts.createSourceFile(registryPath, readFileSync(registryPath, 'utf8'), ts.ScriptTarget.Latest, true);
    const methods: Record<string, RegistryMethod> = {};

    const visit = (node: ts.Node) => {
        if (ts.isClassDeclaration(node) && node.name?.text === 'PluginRegistry') {
            for (const member of node.members) {
                const isPrivate =
                    ts.canHaveModifiers(member) &&
                    ts.getModifiers(member)?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword);
                if (isPrivate || !member.name) {
                    continue;
                }
                const name = member.name.getText(source);
                if (ts.isMethodDeclaration(member)) {
                    methods[name] = {
                        params: member.parameters.map(
                            (p) =>
                                `${p.name.getText(source)}: ${p.type ? p.type.getText(source).replace(/\s+/g, ' ') : 'unknown'}`,
                        ),
                        ...(member.type ? {returnType: member.type.getText(source).replace(/\s+/g, ' ')} : {}),
                    };
                } else if (
                    ts.isPropertyDeclaration(member) &&
                    member.initializer &&
                    ts.isCallExpression(member.initializer)
                ) {
                    const callee = member.initializer.expression.getText(source);
                    if (callee === 'reArg' && ts.isArrayLiteralExpression(member.initializer.arguments[0])) {
                        const argNames = member.initializer.arguments[0].elements.map((el) =>
                            el.getText(source).replace(/^['"]|['"]$/g, ''),
                        );
                        methods[name] = {params: argNames};
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return Object.fromEntries(Object.entries(methods).sort(([a], [b]) => a.localeCompare(b)));
}

function extractPluginTypeNames(typesFile: string): string[] {
    const source = ts.createSourceFile(typesFile, readFileSync(typesFile, 'utf8'), ts.ScriptTarget.Latest, true);
    const names: string[] = [];
    for (const stmt of source.statements) {
        const isExported =
            ts.canHaveModifiers(stmt) && ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (!isExported) {
            continue;
        }
        if (
            (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt) || ts.isEnumDeclaration(stmt)) &&
            stmt.name
        ) {
            names.push(stmt.name.text);
        }
    }
    return names.sort();
}

/** Build the compact 3-layer Host↔Plugin contract (UI slots + OpenAPI + PluginRegistry/types). */
export function extractHostContract(options: {
    version: string;
    slotsPath: string;
    apiSourceDir: string;
    registryPath: string;
    pluginTypesPath: string;
    surface?: SurfaceReport;
}): HostContract {
    const rawSlots = JSON.parse(readFileSync(options.slotsPath, 'utf8')) as Record<
        string,
        {template: string; registry?: string[]; host?: string; reason?: string}
    >;
    const knownIds = new Set(options.surface?.entries.map((entry) => entry.id) ?? []);
    const slots: Record<string, SlotEntry> = {};

    for (const [name, slot] of Object.entries(rawSlots).sort(([a], [b]) => a.localeCompare(b))) {
        if (name === '_doc') {
            continue;
        }
        // Keyed ids are recorded as `scope.name:--role`; a leading `*.` template matches any parent scope.
        const keyedForm = slot.template.replace('{key}', '');
        const verified = keyedForm.startsWith('*.')
            ? [...knownIds].some((id) => id.endsWith(keyedForm.slice(1)))
            : knownIds.has(keyedForm);
        slots[name] = {
            template: slot.template,
            registry: slot.registry ?? [],
            verified,
            ...(slot.host ? {host: slot.host} : {}),
            ...(verified ? {} : {reason: slot.reason ?? 'Host render point not yet instrumented with data-surface.'}),
        };
    }

    const api: HostContract['api'] = {};
    for (const op of extractOpenApi(options.apiSourceDir)) {
        api[op.id] = {
            method: op.method,
            path: op.path,
            params: [...op.pathParams, ...op.queryParams],
            ...(op.responseRef ? {responseRef: op.responseRef} : {}),
        };
    }

    return {
        schemaVersion: 1,
        mattermostVersion: options.version,
        slots,
        api,
        registry: {
            methods: extractRegistryMethods(options.registryPath),
            pluginTypes: extractPluginTypeNames(options.pluginTypesPath),
        },
    };
}

/** Diff two host contracts and report breaking removals or signature mismatches across all 3 layers. */
export function diffHostContracts(
    base: HostContract,
    head: HostContract,
): {
    breaking: BreakingChange[];
    added: string[];
} {
    const breaking: BreakingChange[] = [];
    const added: string[] = [];

    for (const [name, prev] of Object.entries(base.slots)) {
        const next = head.slots[name];
        if (!next) {
            breaking.push({layer: 'slots', symbol: name, reason: 'Plugin UI slot removed'});
        } else if (next.template !== prev.template) {
            breaking.push({
                layer: 'slots',
                symbol: name,
                reason: `Slot template changed: "${prev.template}" -> "${next.template}"`,
            });
        }
    }
    for (const name of Object.keys(head.slots)) {
        if (!base.slots[name]) {
            added.push(`slots.${name}`);
        }
    }

    for (const [opId, prev] of Object.entries(base.api)) {
        const next = head.api[opId];
        if (!next) {
            breaking.push({layer: 'api', symbol: opId, reason: 'API operation removed'});
        } else if (next.method !== prev.method || next.path !== prev.path) {
            breaking.push({
                layer: 'api',
                symbol: opId,
                reason: `Endpoint changed: ${prev.method} ${prev.path} -> ${next.method} ${next.path}`,
            });
        } else if (prev.params.some((p) => !next.params.includes(p))) {
            breaking.push({layer: 'api', symbol: opId, reason: 'Previously supported parameter removed'});
        }
    }
    for (const opId of Object.keys(head.api)) {
        if (!base.api[opId]) {
            added.push(`api.${opId}`);
        }
    }

    for (const [methodName, prev] of Object.entries(base.registry.methods)) {
        const next = head.registry.methods[methodName];
        if (!next) {
            breaking.push({layer: 'registry', symbol: methodName, reason: 'PluginRegistry method removed'});
        } else if (next.params.length < prev.params.length) {
            breaking.push({
                layer: 'registry',
                symbol: methodName,
                reason: `Arity reduced from ${prev.params.length} to ${next.params.length}`,
            });
        }
    }
    for (const typeName of base.registry.pluginTypes) {
        if (!head.registry.pluginTypes.includes(typeName)) {
            breaking.push({layer: 'registry', symbol: typeName, reason: 'Exported plugin type removed'});
        }
    }
    for (const methodName of Object.keys(head.registry.methods)) {
        if (!base.registry.methods[methodName]) {
            added.push(`registry.${methodName}`);
        }
    }

    return {breaking, added};
}

/** Read Mattermost version from `package.json` or fallback string. */
export function readHostVersion(repoRoot: string): string {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'webapp/channels/package.json'), 'utf8')) as {version?: string};
    return pkg.version ?? '0.0.0';
}
