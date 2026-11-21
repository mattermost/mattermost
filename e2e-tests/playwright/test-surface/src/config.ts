// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

/** Symbol-qualified canonical, locale-independent date/time key helpers. */
export type KeyValue = {function: 'dayKey' | 'timeKey'; module: string};

/**
 * Everything the scanner needs to know about a project. Pass its surface config with --config.
 * Every path in the file is relative to the file's own directory.
 */
export type ConfigFile = {

    /** Directory that locations in the manifest are relative to. */
    root: string;

    /** The tsconfig whose program is scanned. */
    tsconfig: string;

    /** `paths` entries added to the tsconfig so workspace packages resolve to their source (relative to its baseUrl, as tsconfig `paths` are). */
    pathOverrides?: Record<string, string[]>;

    /** Directories (relative to root) whose files are scanned. */
    include: string[];

    /** Regular expressions; matching files are not scanned (tests, mocks, stories). */
    exclude?: string[];

    /** Directories (relative to root) where entity types are declared (`Channel`, `Team`...). */
    entityTypeDirs?: string[];

    /** Import prefix for each entity directory (config-relative directory -> package prefix; default @mattermost/types). */
    entityTypeModules?: Record<string, string>;

    /** The REST client whose methods are matched to OpenAPI operations. */
    client?: {file: string; className: string; urlVersion: string} | null;

    /** Directory (relative to root) of OpenAPI yaml files. */
    openapiDir?: string | null;

    /** i18n catalog (relative to root). */
    i18n?: string | null;

    /** Where outputs are written (relative to root). */
    output: {

        /** The committed v4 contract. */
        report?: string;
        generated?: string | null;

        /**
         * Where the generated page objects import the runtime from (`Scope`, the drivers, `apiOp`, `msg`): a package,
         * by default `@mattermost/playwright-lib`, or a path to the runtime's source (starting with `.`) when the
         * generated code is part of the runtime's own package, as the webapp's is.
         */
        runtime?: string;
        reports?: string | null;

        /** Library mode: where `test-surface parts` writes `test-parts.json`. */
        parts?: string | null;
    };

    /** Library mode (a component library such as compass-ui): its entry module and optional scope prop name. */
    library?: {entry: string; testIdProp?: string};

    /**
     * Component libraries whose published `test-parts.json` the scan reads: a package name (from its
     * installed copy) or `{"package": …, "parts": "path/to/test-parts.json"}` (relative to root).
     */
    libraries?: LibraryRef[];

    /** When set, `generate` only emits elements whose template starts with one of these scopes. */
    generateScopes?: string[] | null;

    /**
     * The app's entry modules (relative to this file: a file, or a directory with an index). When set, elements
     * in files not reachable from the configured entries are listed in the scan reports,
     * excluded from checks and not generated.
     */
    entries?: string[];

    /**
     * Migrated test code to check for testids the app no longer renders (directories relative to this file; each
     * lookup that matches nothing is an error in `scan` and `check`), and allowed exceptions: a testid the check
     * can't see is fine (a column-named cell, an id built at runtime).
     */
    staleReferences?: {roots: string[]; allow?: Array<{testid: string; file?: string; reason: string}>};

    /**
     * Where checks are errors rather than warnings: `strictPaths` (repo-relative prefixes; `channels/src/` makes the
     * whole app strict), minus the allowed `strictExceptions` (files or folders that stay warnings, each with why).
     */
    checks?: {strictScopes?: string[]; strictPaths?: string[]; strictExceptions?: StrictException[]; strictExceptionWarningCeiling?: number; allow?: AllowEntry[]; keyFields?: KeyFieldsConfig};

    /** Page class names for route components (`{"ChannelIdentifierRouter": "ChannelsPage"}`); default `<Component>Page`. */
    pageNames?: Record<string, string>;

    /** Stable family names for components whose generated class names would otherwise collide. */
    familyNames?: Record<string, string>;

    /** Stable names for fixed key sets, keyed by their derived name or element path. */
    setNames?: Record<string, string>;

    /** Named functions that return canonical, locale-independent id keys (currently dayKey and timeKey). */
    keyValues?: KeyValue[];

    /**
     * Route params that take an entity or its key, and what tests call them:
     * `{"identifier": {"as": "channel", "entity": "Channel", "field": "name", "module": "@mattermost/types/channels"}}`.
     */
    pageParams?: Record<string, PageParamConfig>;

    /**
     * What shows a page is up, by page class: its `goto` waits for the first of these testids to be visible
     * (`{"ChannelsPage": ["center.composer", "center.archived_notice"]}`). Each must be an element the page renders.
     * A page with nothing to wait for (it redirects, or shows no testid yet) says why:
     * `{"TeamPage": {"ready": null, "reason": "redirects to the team's default channel"}}`. Every page needs an entry.
     */
    pageReady?: Record<string, PageReady>;

    /**
     * Sub-routes a page renders below its own path, as one typed param (`AdminConsolePage.path({section:
     * 'user_management/system_roles'})`): `values`, or `from` the string values of a property in a file (relative to
     * root; `{"file": "channels/src/components/admin_console/admin_definition.tsx", "property": "url"}`). A route param
     * in a value (`user/:user_id`) takes any string there.
     */
    pageSections?: Record<string, PageSections>;

    /** Plugin slot contract and the registry methods that fill each slot. */
    pluginSlots?: Record<string, {template: string; registry?: string[]}>;

    /** Host exports that portal their children; lookup metadata only, never action or observation policy. */
    lookupPortals?: Array<{from: string; name: string; reason: string}>;

    /**
     * Plugin mode reads only the host config's plugin slot table and the listed v4 reports.
     */
    plugin?: {
        manifest: string;
        scope?: string;
        host: {config: string; reports: Array<{name: string; report: string}>};

        /** The type of the registry `initialize` gets (default `PluginRegistry`): only calls on it fill host slots. */
        registryType?: string;
    };
};

export type AllowEntry = {rule: string; template: string; reason: string};

/** A file or folder (repo-relative prefix) under a strict path whose diagnostics stay warnings, and why. */
export type StrictException = {path: string; reason: string};

/**
 * Which entity fields may key a testid without an exception (`checks.keyFields`): `pattern` matches the field's name (by
 * default id-like fields); `allow` lists allowed others (`{"entity": "AppSelectOption", "field": "value", "reason": …}`).
 * With `keys: true` an entry declares the keys of a record field instead of its values (`Object.entries(x.field)`,
 * `Object.keys(x.field)`); such an entry needs `value`, and its keys are free-form, so the element keeps its role.
 */
export type KeyFieldsConfig = {pattern?: string; allow?: KeyFieldAllow[]};
export type KeyFieldAllow = {entity: string; module?: string; field: string; reason: string; freeForm?: true; value?: string; keys?: true};

/** Id-like fields: an id, a unique name, or a foreign key (`channel_id`, `channelId`). A field like `text` can change with the language. */
export const DEFAULT_KEY_FIELDS = '^(id|[a-z_]+_id|[a-z]+Id)$';

export type LibraryRef = string | {package: string; parts: string};

export type PageParamConfig = {as?: string; entity: string; field: string; module: string};

export type PageSections = {param?: string; values?: string[]; from?: {file: string; property: string}};

/** A page's ready testids, or `{ready: null, reason}` for a page with nothing to wait for. */
export type PageReady = string[] | {ready: null; reason: string};

export type Config = {
    configPath: string;
    root: string;
    tsconfig: string;
    pathOverrides: Record<string, string[]>;
    include: string[];
    exclude: RegExp[];
    entityTypeDirs: string[];
    entityTypeModules: Record<string, string>;
    client: {file: string; className: string; urlVersion: string} | null;
    openapiDir: string | null;
    i18n: string | null;
    output: {
        report: string;

        generated: string | null;

        /** A package name, or the absolute path of the runtime's source. */
        runtime: string;
        reports: string | null;
        parts: string | null;
    };
    library: {entry: string; testIdProp: string} | null;
    libraries: LibraryRef[];
    generateScopes: string[] | null;
    entries: string[];
    staleReferences: {roots: string[]; allow: Array<{testid: string; file?: string; reason: string}>} | null;
    checks: {strictScopes: string[]; strictPaths: string[]; strictExceptions: StrictException[]; strictExceptionWarningCeiling?: number; allow: AllowEntry[]; keyFields: {pattern: RegExp; allow: KeyFieldAllow[]}};
    pageNames: Record<string, string>;
    familyNames: Record<string, string>;
    setNames: Record<string, string>;
    keyValues: KeyValue[];
    pageParams: Record<string, PageParamConfig>;
    pageReady: Record<string, PageReady>;
    pageSections: Record<string, PageSections>;
    pluginSlots: Record<string, {template: string; registry?: string[]}> | null;
    lookupPortals: Array<{from: string; name: string; reason: string}>;
    plugin: PluginConfig | null;
};

export type PluginConfig = {
    id: string;

    /** The registry's type name: a call is a registry call when its receiver has this type. */
    registryType: string;

    /** The plugin's id normalized for a testid key (`com_mattermost_calls`); its testids live under `plugins.<key>`. */
    key: string;
    scope: string;
    hostConfig: string;
    slotContract: Record<string, {template: string; registry?: string[]}>;
    hosts: Array<{name: string; report: string}>;
};

/** The config's file name: `findConfig` looks for it; diagnostics about config entries are reported at its path (`configPath`). */
export const CONFIG_FILE = 'test-surface.config.json';

export const DEFAULT_EXCLUDE = [
    '\\.test\\.',
    '__mocks__',
    '/tests?/',
    'test_helpers',
    'testUtils',
    '/testing/',
    '\\.stories\\.',
];

export function loadConfig(configPath: string): Config {
    const abs = path.resolve(configPath);
    const dir = path.dirname(abs);
    const raw = JSON.parse(fs.readFileSync(abs, 'utf8')) as ConfigFile;
    return resolveConfig(raw, dir, abs);
}

export function resolveConfig(raw: ConfigFile, dir: string, configPath = path.join(dir, CONFIG_FILE)): Config {
    const root = path.resolve(dir, raw.root);
    const fromDir = (p: string) => path.resolve(dir, p);
    for (const [entityDir, module] of Object.entries(raw.entityTypeModules ?? {})) {
        if (!(raw.entityTypeDirs ?? []).some((dir) => fromDir(dir) === fromDir(entityDir)) || typeof module !== 'string' || !module.trim() || module.startsWith('.') || module.startsWith('/') || (/\s/).test(module)) {
            throw new Error(`Input error in ${configPath}: entityTypeModules must map a configured entity directory to a package import prefix.`);
        }
    }
    const keyValues = raw.keyValues ?? [];
    const invalid = keyValues.some((entry) => !entry || !['dayKey', 'timeKey'].includes(entry.function) || typeof entry.module !== 'string' || !entry.module.trim());
    if (invalid || new Set(keyValues.map((entry) => JSON.stringify([entry.function, entry.module]))).size !== keyValues.length) {
        throw new Error('keyValues requires unique {function: "dayKey" | "timeKey", module: "import-specifier"} entries.');
    }
    return {
        configPath,
        root,
        tsconfig: fromDir(raw.tsconfig),
        pathOverrides: raw.pathOverrides ?? {},
        include: raw.include.map((p) => path.resolve(dir, p)),
        exclude: (raw.exclude ?? DEFAULT_EXCLUDE).map((r) => new RegExp(r)),
        entityTypeDirs: (raw.entityTypeDirs ?? []).map(fromDir),
        entityTypeModules: Object.fromEntries(Object.entries(raw.entityTypeModules ?? {}).map(([dir, module]) => [fromDir(dir), module.replace(/\/$/, '')])),
        client: raw.client ? {...raw.client, file: fromDir(raw.client.file)} : null,
        openapiDir: raw.openapiDir ? fromDir(raw.openapiDir) : null,
        i18n: raw.i18n ? fromDir(raw.i18n) : null,
        output: {
            report: fromDir(raw.output.report ?? 'webapp.surface.json'),
            generated: raw.output.generated ? fromDir(raw.output.generated) : null,
            runtime: raw.output.runtime?.startsWith('.') ? fromDir(raw.output.runtime) : raw.output.runtime ?? '@mattermost/playwright-lib',
            reports: raw.output.reports ? fromDir(raw.output.reports) : null,
            parts: raw.output.parts ? fromDir(raw.output.parts) : null,
        },
        library: raw.library ? {entry: fromDir(raw.library.entry), testIdProp: raw.library.testIdProp ?? 'testId'} : null,
        libraries: raw.libraries ?? [],
        generateScopes: raw.generateScopes ?? null,
        entries: (raw.entries ?? []).map(fromDir),
        staleReferences: raw.staleReferences ? {roots: raw.staleReferences.roots.map(fromDir), allow: raw.staleReferences.allow ?? []} : null,
        checks: {
            strictScopes: raw.checks?.strictScopes ?? [],
            strictPaths: raw.checks?.strictPaths ?? [],
            strictExceptions: raw.checks?.strictExceptions ?? [],
            strictExceptionWarningCeiling: raw.checks?.strictExceptionWarningCeiling,
            allow: raw.checks?.allow ?? [],
            keyFields: {pattern: new RegExp(raw.checks?.keyFields?.pattern ?? DEFAULT_KEY_FIELDS), allow: raw.checks?.keyFields?.allow ?? []},
        },
        pageNames: raw.pageNames ?? {},
        familyNames: raw.familyNames ?? {},
        setNames: raw.setNames ?? {},
        keyValues: [...keyValues].sort((a, b) => a.module.localeCompare(b.module) || a.function.localeCompare(b.function)),
        pageParams: raw.pageParams ?? {},
        pageReady: raw.pageReady ?? {},
        pageSections: Object.fromEntries(Object.entries(raw.pageSections ?? {}).map(([k, v]) => [k, v.from ? {...v, from: {...v.from, file: path.resolve(root, v.from.file)}} : v])),
        pluginSlots: raw.pluginSlots ?? null,
        lookupPortals: raw.lookupPortals ?? [],
        plugin: raw.plugin ? resolvePlugin(raw.plugin, root) : null,
    };
}

function resolvePlugin(raw: NonNullable<ConfigFile['plugin']>, root: string): PluginConfig {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(root, raw.manifest), 'utf8')) as {id?: string};
    if (!manifest.id) {
        throw new Error(`${raw.manifest} has no "id"`);
    }
    if (!raw.host?.config) {
        throw new Error('plugin.host.config is required and must point at the host surface config.');
    }
    const hostConfig = path.resolve(root, raw.host.config);
    let slotContract: Record<string, {template: string; registry?: string[]}> = {};
    try {
        const host = JSON.parse(fs.readFileSync(hostConfig, 'utf8')) as {pluginSlots?: Record<string, {template: string; registry?: string[]}>};
        slotContract = host.pluginSlots ?? {};
    } catch (error) {
        throw new Error(`Cannot read host pluginSlots from ${hostConfig}: ${String(error)}`);
    }
    return {
        id: manifest.id,
        registryType: raw.registryType ?? 'PluginRegistry',
        key: manifest.id.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        scope: raw.scope ?? `plugins.${manifest.id.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`,
        hostConfig,
        slotContract,
        hosts: raw.host.reports.map((h) => ({name: h.name, report: path.resolve(root, h.report)})),
    };
}

/** Finds the config: an explicit path, else the nearest test-surface.config.json at or above cwd. */
export function findConfig(explicit: string | undefined, cwd = process.cwd()): string {
    if (explicit) {
        return path.resolve(cwd, explicit);
    }
    for (let d = cwd; ; d = path.dirname(d)) {
        for (const candidate of [path.join(d, CONFIG_FILE)]) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        if (path.dirname(d) === d) {
            throw new Error(`No ${CONFIG_FILE} found. Pass --config <path>.`);
        }
    }
}

/** Manifest locations are repo-relative to the config root, with forward slashes. */
export function relativeToRoot(config: Pick<Config, 'root'>, file: string): string {
    return path.relative(config.root, file).split(path.sep).join('/');
}

/** The public type import corresponding to a file under a configured entity directory. */
export function entityTypeModule(config: Pick<Config, 'entityTypeModules'>, dir: string, file: string): string {
    const relative = path.relative(dir, file).replace(/\.tsx?$/, '').split(path.sep).join('/').replace(/\/index$/, '');
    return `${config.entityTypeModules[path.resolve(dir)] ?? '@mattermost/types'}/${relative}`;
}
