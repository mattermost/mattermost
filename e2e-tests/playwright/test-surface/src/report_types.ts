// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The surface report, version 4: the one committed artifact (`lib/surface/webapp.surface.json`), and the generator's
 * only input besides the i18n catalog.
 *
 * In the repository: `e2e-tests/playwright/test-surface/src/report_types.ts`.
 *
 * The report holds STRUCTURE ONLY: what can be on the page, how each thing is addressed, which pages exist and what
 * the client can send. It holds nothing about behaviour: not what an action sends, not what it opens, not where it
 * navigates. A spec states those (`settle(d, {wait})`, `clickTo(destination)`) and the run checks them.
 *
 * It holds no file path, no line, no condition text, no usage chain and no diagnostic (those go to `reports/`,
 * uncommitted). Output is deterministic. It changes when the structure changes, which includes things a user cannot
 * see: a family becoming shared, a key's origin changing through a type.
 */

import type {TestIdRole as Role} from '../lint/grammar.js';

export const REPORT_VERSION = 4;

export type SurfaceReport = {
    version: typeof REPORT_VERSION;

    /** Every component, or literal scope, that renders testids: one generated class each. */
    families: Record<FamilyName, Family>;

    /** Every concrete scope the app can render: a mount of a family, with what fills its keys there. */
    scopes: Record<ScopePath, Mount>;

    /**
     * Every request the client can send, by operation id: the generated `Api`. From the client source alone. Method
     * and path pattern are unique together, placeholder names aside (`/users/{id}` and `/users/{user_id}` are one
     * pattern); two operations that collide are a scan error.
     */
    operations: Record<OpId, Operation>;

    /**
     * The fixed sets keys are drawn from: the generated `sets`. Members sorted.
     *
     * A set's name is the name of the TypeScript type or const its members come from, when it has one
     * (`SettingsTab`). Otherwise it is the keyed element's path in PascalCase plus `Key` (`recaps.tab:{key}` ->
     * `RecapsTabKey`): always with the suffix, so the name does not change the day the keyed element gains members
     * and becomes a family of the same path. A set whose name is still taken (by a family, a page or another set)
     * is a `collisions` error; config `setNames` renames it.
     */
    sets: Record<SetName, string[]>;

    /** Routes, by page class name. */
    pages: Record<PageName, PageDecl>;

    /** The plugin slot contract: slot name -> testid template, `{key}` standing for the plugin id. */
    pluginSlots: Record<string, TestIdTemplate>;

    /** Plugin mode only: which plugin this report describes. */
    plugin?: PluginInfo;
};

/** A generated class name: `ConfirmModal`, `ChannelSettingsModalInfo`. */
export type FamilyName = string;

/** A scope as testids spell it, without key or role: `recaps.recap.delete_modal`. */
export type ScopePath = string;

/** An operation id: the OpenAPI operationId, or the client method's name when the spec has none. */
export type OpId = string;
export type SetName = string;
export type PageName = string;

/** `channel_header.menu.plugin:{key}--menuitem` */
export type TestIdTemplate = string;

// ---------------------------------------------------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------------------------------------------------

/**
 * A family is whatever writes testids relative to one scope. There are two ways to be one, and the report does not
 * tell them apart:
 *
 *  - A component that takes a scope (`testId?: string`) and derives its testids from it with template literals. Its
 *    name is the component's name; each place that passes it a scope is a mount. Its members are everything derived
 *    from that scope, through any component that receives the scope unchanged (`ConfirmModal` handing its `testId`
 *    to `GenericModal`). A component that receives a derived scope (`${testId}.footer`) is a child.
 *  - A scope written as literals. Its name is the scope path in PascalCase (`channel_settings_modal.info` ->
 *    `ChannelSettingsModalInfo`); it has one mount.
 *
 * A scope is a mount of a component family only when everything directly under it derives from that one component's
 * scope prop, and its children are the same families at every mount. A scope that mixes sources (a `GenericModal`
 * given `testId="channel_settings_modal"` whose caller also writes `channel_settings_modal.tabs` literally) is its own
 * literal family, holding the component's parts beside its own; each part's `source` says who renders it. That is the
 * only fallback, and it is decided by where testids come from, never by comparing shapes.
 *
 * Two families that would get the same name are a scan error; config `familyNames` renames one.
 *
 * A component that writes only its own element (`<Button testId='x.save'>` rendering `x.save--button`, an
 * `IconButton` rendering `--button` or `--togglebutton`) declares no members, so it is not a family and its mounts
 * are not scopes: each is a PART of the scope above it (`x`'s part `save`, role `button`, `source: "Button"`), with
 * the role it renders at that place. Only a component whose family has a part or
 * a child is a family. If a family with members renders its own element with different roles at different mounts,
 * the mounts with each role are separate literal families, like any other mixed scope.
 *
 * A top-level scope is declared by having something under it. A bare word on its own (`data-testid='post_textbox'`,
 * or an id a component passes through as its testid) parses as a scope's own element, but with no part and no child
 * it declares nothing: it is not a scope of the report and no family is made for it (the scan lists it under
 * `unscoped`, as a warning). Every testid of the surface therefore has at least two words, except the own element
 * of a scope that has members.
 */
export type Family = {

    /** The element whose testid is the scope itself (`<scope>`, `<scope>--dialog`). Absent: no element carries it. */
    container?: Part;

    /** Elements directly in the scope: `<scope>.<name>[:{key}][--<role>]`, by name. */
    parts?: Record<PartName, Part>;

    /**
     * Scopes directly below: `<scope>.<name>` is a mount of that family, at every mount of this one (so
     * `scopes[<mount>.<name>]` exists for each). With `key`, the child is a repeated item: its own element is
     * `<scope>.<name>:{key}[--<role>]` and its members are found inside that element.
     */
    children?: Record<PartName, Child>;

    /**
     * Top-level scopes rendered inside this scope's element (`markdown` in a post): the class gets an accessor for each,
     * rooted at the element. Sorted.
     */
    renders?: ScopePath[];

    /**
     * The component that renders the members which name no `source` of their own. Absent: the family's name; never
     * written when equal to it. Always a component's name: a component without one (an inline arrow in a table
     * definition) is named by the scan after the nearest named declaration, never `(anonymous)`.
     */
    source?: ComponentName;
};

/** A WORD of the grammar: `save`, `delete_modal`. Also the property name in a binding. */
export type PartName = string;

/** A component's name, never its file: failures print `<testid> (<ComponentName>)`. */
export type ComponentName = string;

export type Part = {

    /**
     * The role SUFFIX of the testid; null for an element without one. It decides the driver and the member's name,
     * and nothing else is ever put here: an element's actual ARIA role, where it differs or where the testid has
     * no suffix (a top-level scope's bare word never has one), is not recorded.
     */
    role: Role | null;

    /** A repeated element. `mount`: each mount says what fills the key (`Mount.bind[name].key`). */
    key?: Key | {kind: 'mount'};

    /**
     * The element renders only under some condition inside the family. Changes only when the element starts or stops
     * being conditional (a form field that may be absent is optional in the generated form type).
     */
    conditional?: true;

    /** Rendered in a portal (a combobox's options): found from the page, not inside the scope's root. */
    portal?: true;

    /**
     * The element is natively `<input type="file">`: its driver is the file input's (`chooseFiles`). Such an element's
     * testid carries no role suffix, so `role` is null; a suffix on one is a scan error.
     *
     * Never with `key`, and never a family's `container`: a keyed file input and a file input that is a scope's own
     * element are scan errors at the source line (rule `key-origin` for the first, `collisions` for the second).
     * Repeated uploads are a file input part inside a repeated item's family.
     */
    native?: 'file';

    /** The component that renders it, when not the family's `source`. */
    source?: ComponentName;
};

export type Child = {
    family: FamilyName;
    key?: Key | {kind: 'mount'};
};

/**
 * What fills a key. Identity is an id, a member of a fixed set, or a position: nothing else.
 *
 *  - `id`: a field of an entity that identifies it (`Channel.id`; a plugin's id; a setting's config path). Tests pass
 *    the entity or the bare string; `as` replaces that with a narrower type the runtime exports (config `keyTypes`:
 *    `AdminSettingKey` for `admin.setting:{key}`).
 *    The second form, `{kind: 'id', value}`, is an id with no entity type that generated code could import. `value`
 *    says what it identifies (`day`, `emoji`, `plugin`, `setting`). It has exactly two sources, both reviewed
 *    entries of the host config, with one ceiling over both, and nothing is recognized by name:
 *      - `keyValues`: a function that builds a canonical value (a calendar day `2026-11-15`, a time `0930`);
 *      - `keyFields` with a `value`: a field that identifies, on a type outside the entity directories (an emoji
 *        item's name, a registered plugin component's `pluginId`, an admin setting's key).
 *    Where the same thing is read from a declared entity (`PluginManifest.id`), the first form is used.
 *    Tests pass the string, or the `as` type (config `keyTypes`: `AdminSettingKey` for setting keys).
 *  - `set`: one of `sets[set]`.
 *  - `index`: the element's position among its siblings, from 0. For free text, found by content
 *    (`list.itemWith({text})`), not by key.
 *
 * There is no untyped key. A key the scan cannot place in one of these is a `key-origin` error at its source line,
 * settled in the source or by a reviewed config entry.
 */
export type Key =
    | {kind: 'id'; entity: string; field: string; from: ModuleName; as?: TypeRef} |
    {kind: 'id'; value: string; as?: TypeRef} |
    {kind: 'set'; set: SetName} |
    {kind: 'index'};

/** A module specifier as generated code imports it: `@mattermost/types/channels`. */
export type ModuleName = string;

export type TypeRef = {type: string; from: ModuleName};

// ---------------------------------------------------------------------------------------------------------------------
// Mounts
// ---------------------------------------------------------------------------------------------------------------------

export type Mount = {
    family: FamilyName;

    /**
     * Rendered in a portal (a modal, a menu): found from the page, not inside the parent scope's element.
     *
     * This is LOOKUP metadata and may over-approximate: looking from the page still finds an element that was in
     * fact inside its parent. It is never evidence of anything, and nothing but the page objects' lookup reads it.
     */
    portal?: true;

    /**
     * What the mount says about the family's members, by part name; `$container` for the scope's own element. A
     * member with nothing to say is omitted. `false`: the part is never rendered at this mount. Parts only: a child
     * is present at every mount of its family (a scope that lacks one is its own literal family), and its entry here
     * holds `key`.
     */
    bind?: Bind;
};

/** The name the scope's own element has in a binding. Not a WORD, so no part can take it. */
export const CONTAINER = '$container';

export type Bind = Record<PartName | typeof CONTAINER, PartBind | false>;

/**
 * What a mount says about one part: `key`, what fills the key here, when the family leaves it to the mount
 * (`{kind: 'mount'}`). For a keyed child, `key` is under the child's name (the child's own members are bound in its
 * own `scopes` entry).
 */
export type PartBind = {key?: Key};

// ---------------------------------------------------------------------------------------------------------------------
// Operations, pages, plugins
// ---------------------------------------------------------------------------------------------------------------------

export type Operation = {
    method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

    /** The path template: `/api/v4/channels/{channel_id}/patch`. */
    path: string;

    /** The response body as a TypeScript type (`Channel`, `Team[] | TeamsWithCount`), or null when unknown. */
    body: string | null;

    /** The module each type named in `body` is imported from. */
    imports?: Record<string, ModuleName>;
};

export type PageDecl = {

    /** The route as the router writes it: `/:team/:path(channels|messages)/:identifier/:postid?`. */
    path: string;

    /** In route order. */
    params?: PageParam[];

    /** The top-level scopes the page renders. Sorted. */
    scopes: ScopePath[];

    /**
     * Testids of which one shows the page is up. `goto` waits for one; `clickTo(page, params)` and
     * `pressTo(key, page, params)` need one and do not accept a page without any. In config order.
     */
    ready?: string[];
    source: ComponentName;
};

export type PageParam = {

    /** The router's name. */
    name: string;

    /** What tests call it, when different (`identifier` -> `channel`). */
    as?: string;
    optional?: true;

    /** The fixed values its pattern allows; the first is the default. In route order. */
    values?: string[];

    /** An entity whose `field` is the value. */
    entity?: {type: string; field: string; from: ModuleName};

    /** A sub-route below the page's own path, appended as written. */
    section?: true;
};

export type PluginInfo = {
    id: string;

    /** The scope its testids live under: `plugins.<word>`. */
    scope: ScopePath;

    /** The host slots its registry calls fill. Sorted. */
    slots: string[];
};

// ---------------------------------------------------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------------------------------------------------

/** The sections, in file order. Each is an object written one entry per line. */
const SECTIONS = ['families', 'scopes', 'operations', 'sets', 'pages', 'pluginSlots'] as const;

/**
 * The report as it is committed. The rules, all of them:
 *
 *  1. `version` first, then the sections in `SECTIONS` order, then `plugin` if present.
 *  2. Every object's keys sorted by UTF-16 code unit (`<`), at every depth. Never by locale.
 *  3. One line per family, per scope, per operation, per set, per page and per plugin slot: the entry's value is
 *     `JSON.stringify` of it, with no added whitespace. `plugin` is one line too.
 *  4. Arrays keep the order the schema gives them (sorted where it says sorted, source order where it says so): the
 *     scanner sorts, the serializer does not.
 *  5. Nothing empty is written: no `{}`, no `[]`, no `false`, no `null` except `Part.role` and `Operation.body`.
 *     (`serialize` does not strip; `validate` in the tool rejects.) An empty section is `{}`.
 *  6. Four-space indent, `\n` line ends, one trailing newline.
 *
 * So a change to one mount is a one-line diff, and two areas touch the same line only when they change the same
 * family.
 */
export function serialize(report: SurfaceReport): string {
    const line = (key: string, value: unknown) => `${JSON.stringify(key)}: ${JSON.stringify(sorted(value))}`;
    const out = ['{', `    "version": ${report.version},`];
    SECTIONS.forEach((name, i) => {
        const section = report[name] as Record<string, unknown>;
        const keys = Object.keys(section).sort(byCodeUnit);
        const last = i === SECTIONS.length - 1 && !report.plugin;
        if (!keys.length) {
            out.push(`    ${JSON.stringify(name)}: {}${last ? '' : ','}`);
            return;
        }
        out.push(`    ${JSON.stringify(name)}: {`);
        keys.forEach((key, j) => out.push(`        ${line(key, section[key])}${j === keys.length - 1 ? '' : ','}`));
        out.push(`    }${last ? '' : ','}`);
    });
    if (report.plugin) {
        out.push(`    ${line('plugin', report.plugin)}`);
    }
    out.push('}', '');
    return out.join('\n');
}

function byCodeUnit(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
}

function sorted(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sorted);
    }
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return Object.fromEntries(Object.keys(record).sort(byCodeUnit).map((key) => [key, sorted(record[key])]));
    }
    return value;
}
