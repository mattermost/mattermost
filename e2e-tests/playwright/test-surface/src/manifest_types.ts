// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Aria, AriaRole} from './roles.ts';

import type {TestIdRole} from '../lint/grammar.js';

export type {Aria, AriaRole};

/**
 * Where something is, repo-relative. Inside the scan it is exact, `channels/src/…/file.tsx:51:9`; the committed
 * manifest names the component instead, `channels/src/…/file.tsx#PostComponent` (`SourceRef`), so an edit that
 * moves lines changes no committed file (`test-surface where <testid>` prints the exact places).
 */
export type Loc = string;

/** `channels/src/…/file.tsx#Component`, or the file alone for module-level code (see `Loc`). */
export type SourceRef = string;

/** A key's proven origin: canonical identity, literal set, entity field, numeric index, or unresolved string. */
export type KeyKind = 'id' | 'set' | 'entity' | 'string' | 'number';

export type KeyInfo = {
    kind: KeyKind;

    /** Name of the fixed set in `Manifest.sets` (kind "set"). */
    set?: string;
    setSource?: string;
    entity?: string;
    field?: string;
    value?: string;

    /** Module the entity type is imported from. */
    module?: string;

    /** TypeScript type a test passes for the key. */
    type: string;

    /** Literal key values seen in source (also present for partly-known string keys). */
    values?: string[];
};

export type Instance = {

    /** Usage chain the testid flowed through, innermost first. */
    via: Loc[];
    keySet?: string[];
};

/** What a render condition depends on. */
export type ConditionKind = 'prop' | 'local state' | 'permission' | 'license/config/flag' | 'layout' | 'store selector' | 'other';

/**
 * A condition an element renders under: as written (negated in an else arm or after an early return), explained
 * (`useSelector` results inlined), and what it depends on (`viaLocal`: through a local value derived from it).
 */
export type RenderCondition = {expr: string; explained: string; kind: ConditionKind; viaLocal?: true; at?: Loc};

export type Element = {

    /** This member lands outside its scope root through a portal. */
    portal?: true;

    /** "channel_settings_modal.tabs.tab:{key}--tab", or the raw testid when it doesn't follow the grammar yet. */
    template: string;

    /** False for testids that don't follow the grammar (legacy). The generator skips them. */
    grammar: boolean;
    scope: string[];
    name: string;
    role: TestIdRole | null;
    key?: KeyInfo;

    /** Where data-testid is emitted, and the component that emits it. */
    component: {name: string; at: Loc};

    /** Other emission points of the same template (exclusive branches). */
    alsoAt?: Loc[];
    instances: Instance[];
    aria: Aria;
    native?: 'file';
    renderedWhen?: RenderCondition[];

    /**
     * For a container or a keyed item: the top-level scopes rendered inside its element (`markdown` in a post), so the
     * generated class has an accessor for each. Scopes something opens (modals, menus, popovers) are left out: they
     * render in a portal, outside it.
     */
    renders?: string[];

    /** Every place it renders is in a file the app's entries never import (config `entries`). Not generated. */
    unreachable?: true;
    form?: {scope: string; field: string; valueType: string};
};

export type FixedSet = {name: string; values: string[]; source: Loc};

export type ManifestOperation = {
    opId: string;
    verb: string;
    path: string;

    /** TypeScript type of the response body, or null when unknown. */
    body: string | null;
    bodyImports?: Record<string, string>;
    inSpec: boolean;
};

/**
 * A route param. `name` is the router's, `as` what tests pass (`identifier` -> `channel`); `values` the
 * fixed set its pattern allows (the first is the default); `entity` an entity whose `field` is the value.
 */
export type PageParam = {
    name: string;
    as: string;
    optional: boolean;
    values?: string[];
    entity?: {type: string; field: string; module: string};

    /**
     * A sub-route below the page's own path (config `pageSections`), appended as written: it may hold slashes, and
     * `${string}` stands for a route param in it (`user_management/user/${string}`).
     */
    section?: true;
};

/**
 * A route: its path as written (`/:team/:path(channels|messages)/:identifier/:postid?`), params, and the scopes it
 * renders. `ready`: testids of which one shows the page is up; `goto` waits for it (config `pageReady`).
 */
export type Page = {
    class: string;
    path: string;
    params: PageParam[];
    scopes: string[];
    ready?: string[];

    /** Why the page has nothing to wait for (`pageReady` gives `{ready: null, reason}`): it redirects, or shows no testid yet. */
    noReady?: string;
    component: {name: string; at: Loc};
};

export type ComponentScopes = {name: string; at: Loc; scopes: string[]};

/** A testid a library component derives from its `testId` prop (compass-ui `test-parts.json`). */
export type TestPart = {
    native?: 'file';

    /** Appended to the usage's `testId`: `--dialog`, `.close--button`, `.tab:{key}--tab`. */
    suffix: string;
    role: TestIdRole | null;

    /** TypeScript type of `{key}`, for keyed parts. */
    key?: string;

    /** Only rendered when the usage sets (`set: true`) or doesn't set the prop (`IconButton` `toggled` -> `--togglebutton`). */
    when?: {prop: string; set: boolean};

    at: SourceRef;
};

/** What a component library publishes for the webapp's scan: per exported component, its parts and pass-through role. */
export type TestParts = {
    version: 1;
    package: string;
    packageVersion: string;
    testIdProp: string;
    components: Record<string, {at: SourceRef; role: AriaRole | null; parts: TestPart[]}>;
};

/** A host-owned plugin slot from the published contract: its testid template (`{key}` = plugin key). */
export type PluginSlot = {slot: string; template: string; registry?: string[]; at: Loc};

/** Plugin mode: which plugin this is, and the host slots its registry calls fill. */
export type PluginInfo = {
    id: string;
    key: string;
    scope: string;
    slotsUsed: Array<{method: string; slots: string[]; at: Loc}>;
};

/** Every rule a diagnostic can come from (README "Reading a scan error" says what each checks). */
export type RuleName = 'grammar' | 'unscoped' | 'undefined' | 'role-fit' | 'duplicates' | 'key-origin' | 'unresolved' | 'truncated' |
    'plugin-slots' | 'plugin-scope' | 'plugin-compat' | 'pages' | 'input' | 'allow' | 'stale-reference' | 'collisions' |
    'generate' | 'parts' | 'strict-exceptions';

export type Diagnostic = {
    rule: RuleName;
    severity: 'error' | 'warning';
    at: Loc;
    message: string;
    fix?: string;

    /** The testid template it is about, and the literal key of a keyed one: what `checks.allow` entries match. */
    template?: string;
    key?: string;

    /** The usage chain the testid's value came through, innermost first. */
    via?: Loc[];

    /** A allowed exception made this a warning: an `allow` entry, or a strict path's exception. */
    waived?: {by: 'allow' | 'strict-exception'; reason: string};
};

/** The manifest format this version writes and reads (`Manifest.version`): 2 names places by `SourceRef`, holds no diagnostics. */
export const MANIFEST_VERSION = 2;

export type Manifest = {
    version: typeof MANIFEST_VERSION;
    generatedFrom: {
        tsconfig: string;
        scope: string[];

        /**
         * The component libraries the scan read (config `libraries`): the installed version, and whether it published
         * `test-parts.json`. A different install shows up here as a one-line change instead of as different roles.
         */
        libraries?: Array<{package: string; version: string; parts: boolean}>;
    };
    elements: Element[];
    sets: FixedSet[];
    operations: ManifestOperation[];
    pages: Page[];

    /** The plugin slot contract (empty when the config has none). */
    pluginSlots: PluginSlot[];

    /** Plugin mode only. */
    plugin?: PluginInfo;

    /** Candidate dialog components declared in descriptors, with the testid scopes they render. */
    components: ComponentScopes[];
};
