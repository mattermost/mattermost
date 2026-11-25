// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

import {globSync} from 'glob';
import yaml from 'js-yaml';

import type {SurfaceEntry, SurfaceReport} from './scan.js';

export type ApiOp = {
    id: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    pathParams: string[];
    queryParams: string[];
    responseRef?: string;
};

export type PageSpec = {
    path: string;
    ready: string[];
    scopes?: string[];
};

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const RESERVED_SCOPES = new Set(['pages']);

function parseYamlFragment(filePath: string): Record<string, unknown> {
    const raw = readFileSync(filePath, 'utf8');
    let parsed: unknown;
    try {
        parsed = yaml.load(raw);
    } catch {
        parsed = yaml.load(`paths:\n${raw}`);
    }
    if (parsed && typeof parsed === 'object' && 'paths' in parsed) {
        return (parsed as {paths?: Record<string, unknown>}).paths ?? {};
    }
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).some((key) => key.startsWith('/'))) {
        return parsed as Record<string, unknown>;
    }
    const wrapped = yaml.load(`paths:\n${raw}`);
    if (wrapped && typeof wrapped === 'object' && 'paths' in wrapped) {
        return (wrapped as {paths?: Record<string, unknown>}).paths ?? {};
    }
    return {};
}

function toSafeIdent(raw: string): string {
    const clean = raw.replace(/[^A-Za-z0-9_]/g, '_');
    return /^\d/.test(clean) ? `_${clean}` : clean;
}

function toCamelCase(raw: string): string {
    return raw.replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

/**
 * Extract normalized OpenAPI operations directly from `api/v4/source/*.yaml`.
 * A duplicated operationId (an upstream spec defect) keeps the first route under its id and numbers later ones
 * (`SearchFiles2`), reported through `onDuplicate`, so no route is dropped silently.
 */
export function extractOpenApi(apiSourceDir: string, onDuplicate?: (message: string) => void): ApiOp[] {
    const files = globSync('*.yaml', {cwd: apiSourceDir, absolute: true}).sort();
    const ops = new Map<string, ApiOp>();

    for (const file of files) {
        if (file.endsWith('definitions.yaml') || file.endsWith('introduction.yaml')) {
            continue;
        }
        const paths = parseYamlFragment(file);
        for (const [routePath, pathObj] of Object.entries(paths)) {
            if (!routePath.startsWith('/api/') || !pathObj || typeof pathObj !== 'object') {
                continue;
            }
            const pathRecord = pathObj as Record<string, unknown>;
            const sharedParams = Array.isArray(pathRecord.parameters) ? pathRecord.parameters : [];
            for (const methodKey of HTTP_METHODS) {
                const op = pathRecord[methodKey] as Record<string, unknown> | undefined;
                if (!op || typeof op.operationId !== 'string') {
                    continue;
                }
                const allParams = [...sharedParams, ...(Array.isArray(op.parameters) ? op.parameters : [])];
                const pathParams: string[] = [];
                const queryParams: string[] = [];
                for (const param of allParams) {
                    if (!param || typeof param !== 'object') {
                        continue;
                    }
                    const p = param as {name?: unknown; in?: unknown};
                    if (typeof p.name !== 'string') {
                        continue;
                    }
                    if (p.in === 'path' && !pathParams.includes(p.name)) {
                        pathParams.push(p.name);
                    } else if (p.in === 'query' && !queryParams.includes(p.name)) {
                        queryParams.push(p.name);
                    }
                }
                const responses = op.responses as
                    Record<string, {content?: Record<string, {schema?: {$ref?: string}}>}> | undefined;
                const okResp = responses?.['200'] ?? responses?.['201'];
                const schemaRef = okResp?.content?.['application/json']?.schema?.$ref;
                const responseRef = schemaRef ? schemaRef.split('/').pop() : undefined;
                let id = op.operationId;
                for (let n = 2; ops.has(id); n++) {
                    id = `${op.operationId}${n}`;
                }
                if (id !== op.operationId) {
                    onDuplicate?.(
                        `operationId "${op.operationId}" is used by ${ops.get(op.operationId)?.method} ${ops.get(op.operationId)?.path} and ${methodKey.toUpperCase()} ${routePath}; the latter is emitted as Api.${id}`,
                    );
                }
                ops.set(id, {
                    id,
                    method: methodKey.toUpperCase() as ApiOp['method'],
                    path: routePath,
                    pathParams,
                    queryParams,
                    ...(responseRef ? {responseRef} : {}),
                });
            }
        }
    }

    return [...ops.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Read flat i18n message catalog from `en.json` (unwrapping `{defaultMessage}` entries). */
export function extractMessages(enJsonPath: string): Record<string, string> {
    const raw = JSON.parse(readFileSync(enJsonPath, 'utf8')) as Record<string, string | {defaultMessage?: string}>;
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(raw)) {
        out[key] = typeof val === 'string' ? val : (val.defaultMessage ?? '');
    }
    return out;
}

const HEADER =
    '// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.\n// See LICENSE.txt for license information.\n\n// Auto-generated by @mattermost/ui-surface. Do not edit or commit.\n\n';

function driverTypeFor(entry: SurfaceEntry): {fn: string; type: string} {
    if (['checkbox', 'switch', 'radio', 'tab', 'option', 'togglebutton'].includes(entry.role)) {
        return {fn: 'stateDriver', type: 'StateDriver'};
    }
    if (['textbox', 'searchbox', 'spinbutton', 'combobox'].includes(entry.role)) {
        return {fn: 'inputDriver', type: 'InputDriver'};
    }
    if (entry.role === 'file') {
        return {fn: 'fileInputDriver', type: 'FileInputDriver'};
    }
    return {fn: 'elementDriver', type: 'ElementDriver'};
}

/** Generate gitignored `api.generated.ts`, `messages.generated.ts`, and `surface.generated.ts`. */
export function emitGenerated(options: {
    outDir: string;
    surface: SurfaceReport;
    ops: ApiOp[];
    pages: Record<string, PageSpec>;
    enJsonPath: string;
}): {files: string[]} {
    mkdirSync(options.outDir, {recursive: true});

    const apiTypeNames = options.ops.map((op) => JSON.stringify(toSafeIdent(op.id))).join(' | ') || 'never';
    const apiLines = [
        HEADER,
        'export type ApiOperation = {',
        '    readonly id: string;',
        "    readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';",
        '    readonly path: string;',
        '    readonly pathParams: readonly string[];',
        '    readonly queryParams: readonly string[];',
        '};',
        '',
        `export type ApiOpKey = ${apiTypeNames};`,
        '',
        '// `as const` keeps each pathParams tuple literal, so settle({params}) typos fail type checking.',
        'export const Api = {',
        ...options.ops.map(
            (op) =>
                `    ${toSafeIdent(op.id)}: ${JSON.stringify({id: op.id, method: op.method, path: op.path, pathParams: op.pathParams, queryParams: op.queryParams})},`,
        ),
        '} as const satisfies Record<ApiOpKey, ApiOperation>;',
        '',
    ];
    const apiFile = join(options.outDir, 'api.generated.ts');
    writeFileSync(apiFile, apiLines.join('\n'));

    const messages = extractMessages(options.enJsonPath);
    const msgEntries = Object.entries(messages).sort(([a], [b]) => a.localeCompare(b));
    const msgKeyUnion = msgEntries.map(([k]) => JSON.stringify(k)).join(' | ') || 'never';
    const msgFile = join(options.outDir, 'messages.generated.ts');
    writeFileSync(
        msgFile,
        [
            HEADER,
            `export type MsgKey = ${msgKeyUnion};\n`,
            `export const Msg: Record<MsgKey, string> = {\n${msgEntries.map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}\n};\n`,
        ].join('\n'),
    );

    const usedHelpers = new Set<string>();
    const scopeBlocks: string[] = [];
    const collisions: string[] = [];
    for (const scope of Object.keys(options.surface.scopes).sort()) {
        if (RESERVED_SCOPES.has(toSafeIdent(scope))) {
            collisions.push(`scope "${scope}" collides with the reserved surface key "${toSafeIdent(scope)}"`);
        }
        const {parts, containerFiles} = options.surface.scopes[scope];
        const propLines: string[] = [];
        const seenProp = new Map<string, SurfaceEntry>();
        for (const part of parts) {
            const prop = toCamelCase(part.name);
            if (prop === 'container' && containerFiles.length > 0) {
                collisions.push(
                    `${scope}.container: "${part.id}" (${part.file}:${part.line}) collides with the scope's generated container`,
                );
            }
            const prev = seenProp.get(prop);
            if (prev) {
                if (prev.id !== part.id || prev.role !== part.role || prev.keyed !== part.keyed) {
                    collisions.push(
                        `${scope}.${prop}: "${prev.id}" (${prev.file}:${prev.line}) and "${part.id}" (${part.file}:${part.line}) map to the same property`,
                    );
                }
                continue;
            }
            seenProp.set(prop, part);
            const {fn} = driverTypeFor(part);
            usedHelpers.add(fn);
            const attrArg = part.attr === 'data-surface' ? ", 'data-surface'" : '';
            if (part.keyed) {
                const [head, tail] = part.id.split(':');
                propLines.push(
                    `        ${prop}: (key: string) => ${fn}(scope, ${JSON.stringify(head)} + ':' + key + ${JSON.stringify(tail)}, ${JSON.stringify(part.role)}${attrArg}),`,
                );
            } else {
                propLines.push(
                    `        ${prop}: ${fn}(scope, ${JSON.stringify(part.id)}, ${JSON.stringify(part.role)}${attrArg}),`,
                );
            }
        }
        // A scope with a rendered `data-surface="<scope>"` container resolves inside it by default, so an
        // overlay that reuses the same ids elsewhere on the page cannot trip strict mode.
        const defaultRoot =
            containerFiles.length > 0 ? `page.locator(${JSON.stringify(`[data-surface="${scope}"]`)})` : 'page';

        // The container element itself, found under the caller's root (or the page), never under the default root.
        if (containerFiles.length > 0) {
            usedHelpers.add('elementDriver');
            propLines.unshift(
                `        container: elementDriver(root ?? page, ${JSON.stringify(scope)}, 'container', 'data-surface'),`,
            );
        }
        scopeBlocks.push(
            `    ${toSafeIdent(scope)}: (root?: Locator) => {\n        const scope = root ?? ${defaultRoot};\n        return {\n${propLines.join('\n')}\n        };\n    },`,
        );
    }
    if (collisions.length > 0) {
        throw new Error(`Surface codegen collisions (rename one side):\n- ${collisions.join('\n- ')}`);
    }

    const entryById = new Map(options.surface.entries.map((entry) => [entry.id, entry]));
    const pageBlocks = Object.entries(options.pages)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, spec]) => {
            const readyList = spec.ready
                .map((id) => {
                    return entryById.get(id)?.attr === 'data-surface'
                        ? `page.locator(${JSON.stringify(`[data-surface="${id}"]`)})`
                        : `page.getByTestId(${JSON.stringify(id)})`;
                })
                .join(', ');
            return `    ${toSafeIdent(name)}: {\n        pathPattern: ${JSON.stringify(spec.path)},\n        pathFor: (params: Record<string, string> = {}) => ${JSON.stringify(spec.path)}.replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) => {\n            if (!params[key]) {\n                throw new TypeError(${JSON.stringify(`pages.${name}.pathFor() is missing param`)} + ' "' + key + '"');\n            }\n            return params[key];\n        }),\n        readyLocators: [${readyList}],\n    },`;
        });

    const helperImports = [...usedHelpers].sort();
    const typeImport =
        scopeBlocks.length > 0
            ? "import type {Locator, Page} from '@playwright/test';\n"
            : "import type {Page} from '@playwright/test';\n";
    const driverImport = helperImports.length > 0 ? `import {${helperImports.join(', ')}} from '../drivers.js';\n` : '';
    const surfaceFile = join(options.outDir, 'surface.generated.ts');
    writeFileSync(
        surfaceFile,
        [
            HEADER,
            typeImport,
            driverImport,
            'export function createSurface(page: Page) {\n    return {\n',
            ...scopeBlocks,
            '        pages: {',
            ...pageBlocks,
            '        },',
            '    };\n}\n',
        ].join('\n'),
    );

    return {files: [apiFile, msgFile, surfaceFile].map((p) => resolve(p))};
}
