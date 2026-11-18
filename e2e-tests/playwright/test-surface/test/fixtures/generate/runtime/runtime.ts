// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The runtime's types: bindings, drivers, scopes, pages, `settle`, `waitForApi`, `expect`.
 *
 * In the repository: `e2e-tests/playwright/lib/src/aria/`. This file declares; it implements nothing. What is not
 * here is unchanged (`msg`/`formatMessage`, `buildPath`, `registerPluginSurface`, `testIdSelector`, `ContentFilter`)
 * or removed (see the end of the file).
 *
 * The idea in one paragraph: a generated class describes a FAMILY (what parts exist), a generated constant describes
 * a MOUNT (which parts are rendered there and what fills their keys: the BINDING). Nothing generated says what an
 * action does. A spec says it where it acts: `settle(driver, {wait: Api.X}).click()` names the request,
 * `driver.clickTo(destination)` names where the click leads, and the run checks both.
 */

import type {Locator, Page, Response} from '@playwright/test';
import type {expect as playwrightExpect} from '@playwright/test';

import type {AnyApiOp, BodyOf, PathParamsOf, QueryFilter} from './api';
import type {Role} from './roles';
import type {SettleVerb} from './verbs';

export type {AnyApiOp, ApiOp, BodyOf, HttpMethod, PathParamsOf, QueryFilter} from './api';
export {apiOp, defineApi} from './api';

// ---------------------------------------------------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------------------------------------------------

/**
 * What a mount says about a part: `false` when the part is never rendered there; otherwise an object that is empty
 * except, at type level, for the key's type when the family leaves the key to the mount (`Keyed<SettingsTab>`).
 */
export type PartBinding = false | {readonly __key?: unknown; readonly index?: true};

export type Keyed<K extends string | number, P extends object = {}> = P & {readonly __key?: K} & KeyIsIndex<K>;

/**
 * A mount that keys by position says so in the binding's value, since the family's class is shared by mounts that key
 * otherwise: generated code passes it on (`{index: this.bind.row.index}`), and the list's keys come back as numbers.
 */
type KeyIsIndex<K> = [K] extends [number] ? {readonly index: true} : [number] extends [K] ? {readonly index?: true} : {readonly index?: undefined};

/**
 * The key a mount gives a keyed part or a keyed child whose family leaves the key to the mount. It is the key itself
 * (an id string, a set member, an index): passing the entity instead is offered only where the family fixes the key,
 * since only then is the field known.
 */
export type KeyOf<P> = P extends {readonly __key?: infer K extends string | number} ? K : never;

/** What a part's getter returns at a mount where the part is never rendered: nothing can be called on it. */
export type NotRendered = {readonly notRendered: true};

/** `D` where the part is rendered, `NotRendered` where its binding is `false`. Never `never`: misuse must not compile. */
export type Part<D, P extends PartBinding> = P extends false ? NotRendered : D;

// ---------------------------------------------------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Something an action can lead to on the same browser page: an element, or a scope that has an element of its own to
 * wait for (its generated `container`). A scope that only prefixes its members' testids never arrives.
 */
export type Destination = RootedScope | AnyDriver;

/** A scope whose own element is rendered: the generator gives it a `container` driver. */
export type RootedScope = Scope<any> & {readonly container: AnyDriver};

export type ToOptions = {

    /** One budget, counted from the call (default 30 s): it covers the action and the wait for the destination. */
    timeout?: number;
};

/**
 * Base of every generated page class. `Ready` is `true` when the report lists at least one ready testid for the page.
 * The generated class keeps its static `route` and static `path(params)`; `pathFor` is the same function on the
 * instance, which is what `clickTo` and `pressTo` read.
 */
export declare abstract class SurfacePage<Params = void, Ready extends boolean = boolean> {
    readonly page: Page;
    constructor(page: Page);

    /** The URL path for these params. */
    abstract pathFor(params: Params): string;

    /** The elements of which one shows the page is up. Empty when the report gives none. */
    abstract readonly ready: Ready extends true ? readonly [Locator, ...Locator[]] : readonly Locator[];

    /** Navigates here and, when the page has a ready element, waits for one. */
    goto(params: Params): Promise<this>;
}

/** A page `clickTo` and `pressTo` accept: one that has a ready element to wait for. Nothing invents one. */
export type ReadyPage = SurfacePage<any, true>;

export type ParamsOf<P> = P extends SurfacePage<infer Params, boolean> ? Params : never;

// ---------------------------------------------------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------------------------------------------------

export type Meta = {
    readonly testId: string;
    readonly role: Role | null;

    /**
     * The component that renders the element: the report's `source` for the part, else the family's. Failures print
     * `  element: <testId> (<source>)`.
     */
    readonly source: string;
};

/**
 * A driver operates one ARIA pattern on one element. Every method named in `VERBS` performs its action and resolves
 * to nothing: it does not wait for requests (`settle(driver, {wait})` does) and it predicts no destination
 * (`clickTo` and `pressTo` take one).
 */
export declare class Driver {
    readonly locator: Locator;
    readonly meta: Meta;
    constructor(locator: Locator, meta: Meta);
    get page(): Page;
    isVisible(): Promise<boolean>;
    isDisabled(): Promise<boolean>;
    scrollIntoView(): Promise<void>;
    hover(): Promise<void>;
    focus(): Promise<void>;
    blur(): Promise<void>;

    /**
     * Presses a key or a chord (`Control+Enter`) with the element focused. With more keys, a key SEQUENCE as one
     * action: the element is focused once, then every key goes to whatever has focus, in order, as a user's keyboard
     * does. (Two separate `press` calls each refocus their own element first.)
     */
    press(key: string, ...moreKeys: string[]): Promise<void>;

    /**
     * Presses ONE key or chord and arrives: `pressTo('Enter', app.searchResults)`. Exactly `clickTo`'s contract, with
     * the press in place of the click.
     */
    pressTo<T extends Destination>(key: string, destination: T, opts?: ToOptions): Promise<T>;
    pressTo<P extends ReadyPage>(key: string, destination: P, params: ParamsOf<P>, opts?: ToOptions): Promise<P>;
}

/** An element without a role: a region of the page. */
export declare class ContainerDriver extends Driver {}

/**
 * A native `<input type="file">` (report: `native: 'file'`). It has its own testid; nothing follows a button to it.
 * Uploads are sent on the input's `change`, so this is the action to settle:
 * `settle(composer.fileInput, {wait: Api.UploadFile, count: 2}).chooseFiles(paths)`.
 */
export declare class FileInputDriver extends Driver {
    chooseFiles(paths: string | readonly string[]): Promise<void>;
}

export declare class ButtonDriver extends Driver {
    click(): Promise<void>;

    /**
     * Clicks and arrives. The spec says where the click leads; the run checks it:
     *
     *  1. One immediate sample, no retrying: the destination must NOT be visible (for a page: the current path must
     *     not already equal `destination.pathFor(params)`). Otherwise it fails at once, naming both.
     *  2. The driver's ordinary click, never forced.
     *  3. Waits for the destination: a scope or an element, visible; a page, its normalized path equal to
     *     `pathFor(params)` AND one of its ready elements visible, both in the same sample.
     *  4. Resolves to the destination, typed as it was passed in.
     *
     * The destination must be on the same Playwright `Page` as the driver (a popup is
     * `Promise.all([page.waitForEvent('popup'), d.click()])`). It proves the destination was not visible at one sample
     * before and became visible after; it does not prove the click caused it.
     */
    clickTo<T extends Destination>(destination: T, opts?: ToOptions): Promise<T>;
    clickTo<P extends ReadyPage>(destination: P, params: ParamsOf<P>, opts?: ToOptions): Promise<P>;
}

export declare class LinkDriver extends ButtonDriver {
    href(): Promise<string | null>;
}

export declare class MenuitemDriver extends ButtonDriver {}

export declare class MenuitemCheckDriver extends ButtonDriver {
    isChecked(): Promise<boolean>;
}

export declare class TogglebuttonDriver extends Driver {
    isPressed(): Promise<boolean>;

    /** Clicks only when it isn't already in the wanted state, then checks it is. */
    setPressed(on?: boolean): Promise<void>;

    /** One click, whatever the state. */
    toggle(): Promise<void>;
}

export declare class SwitchDriver extends Driver {
    isOn(): Promise<boolean>;
    set(on: boolean): Promise<void>;
    toggle(): Promise<void>;
}

export declare class CheckboxDriver extends Driver {
    isChecked(): Promise<boolean>;
    check(): Promise<void>;
    uncheck(): Promise<void>;
    set(checked: boolean): Promise<void>;
}

export declare class RadioDriver extends CheckboxDriver {}

export declare class RadiogroupDriver extends Driver {
    radio(option: string | RegExp): Locator;
    choose(option: string | RegExp): Promise<void>;
    isChosen(option: string | RegExp): Promise<boolean>;
}

export declare class TextboxDriver extends Driver {
    fill(value: string): Promise<void>;
    clear(): Promise<void>;

    /** Types like a user, a key at a time. */
    type(value: string): Promise<void>;
    value(): Promise<string>;
}

export declare class TabDriver extends Driver {
    select(): Promise<void>;
    isSelected(): Promise<boolean>;
}

export declare class ComboboxDriver extends Driver {
    choose(option: string | RegExp): Promise<void>;

    /** Types into the combobox's input to filter its options (or to name a new one in a creatable select). */
    fill(value: string): Promise<void>;
    clear(): Promise<void>;

    /** The same, a key at a time, for inputs that react to keystrokes. */
    type(value: string): Promise<void>;
    isExpanded(): Promise<boolean>;
}

export declare class TextDriver extends Driver {
    text(): Promise<string>;
    textIfPresent(): Promise<string | null>;
}

export declare class OptionDriver extends TextDriver {
    select(): Promise<void>;
    isSelected(): Promise<boolean>;
}

/** The driver of each role. A role added to the grammar fails to compile here until it has one. */
export type RoleDrivers = {
    button: ButtonDriver;
    link: LinkDriver;
    textbox: TextboxDriver;
    searchbox: TextboxDriver;
    checkbox: CheckboxDriver;
    switch: SwitchDriver;
    radio: RadioDriver;
    radiogroup: RadiogroupDriver;
    combobox: ComboboxDriver;
    listbox: ComboboxDriver;
    option: OptionDriver;
    tab: TabDriver;
    tablist: TextDriver;
    tabpanel: TextDriver;
    menu: TextDriver;
    menuitem: MenuitemDriver;
    menuitemcheckbox: MenuitemCheckDriver;
    menuitemradio: MenuitemCheckDriver;
    dialog: TextDriver;
    alertdialog: TextDriver;
    slider: TextDriver;
    spinbutton: TextboxDriver;
    togglebutton: TogglebuttonDriver;
    text: TextDriver;
    img: TextDriver;
    list: TextDriver;
    listitem: TextDriver;
    row: TextDriver;
    grid: TextDriver;
    gridcell: TextDriver;
    status: TextDriver;
    alert: TextDriver;
    tooltip: TextDriver;
    region: TextDriver;
    separator: TextDriver;
} extends infer Table extends Record<Role, Driver>
    ? Table
    : never;

export type DriverFor<R extends Role | null> = R extends Role ? RoleDrivers[R] : ContainerDriver;

/** Any driver. */
export type AnyDriver = {readonly locator: Locator; readonly meta: Meta};

// ---------------------------------------------------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Base of every generated class. `B` is the family's binding at this mount: one property per part (a `PartBinding`),
 * per child (the child family's binding), and `$container` for the scope's own element.
 *
 * Generated code passes each member's binding to the helper, with the type arguments written out
 * (`this.part<'button', B['confirm']>('confirm', 'button', this.bind.confirm)`): TypeScript reads `this.bind.confirm`
 * as the constraint's type, not as `B['confirm']`, so inference would lose whether the mount renders the part. Every
 * return type is written out too; nothing is inferred across files.
 *
 * A generated member may not take a name this class has: `page`, `scope`, `root`, `bind`, `locator`, `part`, `keyed`,
 * `list`, `partList`, `own`, `item`, `fileInput`; nor `container` (the own element's getter), `fill` or `read` (a form's). The scan's
 * `collisions` rule reports a testid that would, and one whose member name another's takes (`action_list` beside a
 * keyed `action`). Nothing is renamed silently.
 */
export declare class Scope<B = unknown> {
    readonly page: Page;

    /** The scope's testid path at this mount: `recaps.recap.delete_modal`. */
    readonly scope: string;

    /** Where members are looked for: the page, or a repeated item's element. */
    readonly root: Locator;
    protected readonly bind: B;

    /** `self`: the scope's own element when it is not `root.getByTestId(scope)` (a repeated item is its own root). */
    constructor(page: Page, scope: string, bind: B, root?: Locator, self?: Locator);

    /** The scope's own element. Matchers take scopes: `expect(app.recaps).toBeVisible()`. */
    get locator(): Locator;

    /** `<scope>.<name>[--<role>]` */
    protected part<R extends Role | null, P extends PartBinding>(name: string, role: R, binding: P, opts?: MemberOptions): Part<DriverFor<R>, P>;

    /** `<scope>.<name>`, a native file input (report: `native: 'file'`). */
    protected fileInput<P extends PartBinding>(name: string, binding: P, opts?: MemberOptions): Part<FileInputDriver, P>;

    /** `<scope>.<name>:<key>[--<role>]` */
    protected keyed<R extends Role | null, P extends PartBinding, K extends string | number>(
        name: string,
        role: R,
        key: K,
        binding: P,
        opts?: MemberOptions,
    ): Part<DriverFor<R>, P>;

    /** Every `<scope>.<name>:{key}[--<role>]` of a keyed child, as a list by key. */
    protected list<K extends string | number, Item>(name: string, role: Role | null, itemOf: (key: K) => Item, opts?: ListOptions): KeyedList<K, Item>;

    /** The same for a keyed part: `NotRendered` at a mount that never renders it. */
    protected partList<K extends string | number, Item, P extends PartBinding>(
        name: string,
        role: Role | null,
        binding: P,
        itemOf: (key: K) => Item,
        opts?: ListOptions,
    ): Part<KeyedList<K, Item>, P>;

    /** The scope's own element as a driver: `<scope>[--<role>]`, or a repeated item's element. */
    protected own<R extends Role | null, P extends PartBinding>(role: R, binding: P, opts?: {source?: string}): Part<DriverFor<R>, P>;

    /** The element of a repeated child, `<scope>.<name>:<key>[--<role>]`: the child's `root` and `self`. */
    protected item(name: string, role: Role | null, key: string | number, opts?: {portal?: true}): Locator;
}

/** What generated code tells a helper about a member, beyond its name, role and binding. */
export type MemberOptions = {

    /** Rendered in a portal: found from the page, not inside the scope's root. */
    portal?: true;

    /** The component that renders it, when that is not the family's class name: what failures print. */
    source?: string;
};

export type ListOptions = MemberOptions & {

    /** The keys are positions (`{kind: 'index'}`): `keys()` returns numbers. For a key the mount supplies, the binding's `index`. */
    index?: true;
};


/** The items of a repeated testid, by key, in document order. Unchanged, except that a key can hold any character. */
export declare class KeyedList<K extends string | number = string, Item = Locator> {
    readonly locator: Locator;

    /** The testid pattern, for failure messages: `recaps.recap:{key}`. */
    readonly label: string;
    item(key: K): Item;
    keys(): Promise<K[]>;
    first(opts?: {timeout?: number}): Promise<Item>;
    last(opts?: {timeout?: number}): Promise<Item>;
    keyWith(filter: {text?: string | RegExp; has?: Locator}, opts?: {timeout?: number}): Promise<K>;
    itemWith(filter: {text?: string | RegExp; has?: Locator}, opts?: {timeout?: number}): Promise<Item>;
}

/** An entity or its key: `{id: 'abc'}` or `'abc'` -> `'abc'`. */
export declare function keyOf<T extends object, F extends keyof T>(value: Pick<T, F> | string, field: F): string;

// ---------------------------------------------------------------------------------------------------------------------
// settle, waitForApi
// ---------------------------------------------------------------------------------------------------------------------

export type SettleOptions<W extends AnyApiOp, Count extends number | undefined = undefined> = {

    /** The request the action sends. Required: nothing predicts it. */
    wait: W;

    /**
     * Values for the operation's path placeholders, so only that entity's request counts. With every placeholder
     * filled, the request's path must be exactly the filled path. With one left open, the request must belong to
     * this operation in the whole catalog (the most specific pattern wins: `GET /users/me` is `GetMe`, never
     * `GetUser`) and agree with the placeholders that were filled.
     */
    params?: PathParamsOf<W>;

    /**
     * Tells two requests of this one operation apart by their query string: a string means the key is there exactly
     * once with that value, `null` means the key is absent, unlisted keys are ignored (`matchesQuery` in api.ts).
     * Applied when a request is registered, after the path rule and before its status, its body or `count`: a
     * request that fails it is not a candidate, whatever it answers.
     *
     *     settle(addButton, {wait: Api.GetUsers, query: {in_team: team.id, not_in_channel: null}}).click()
     *
     * Use it only where a spec has to tell two query variants apart, and say why there.
     */
    query?: QueryFilter;

    /** Expect this status instead of a 2xx. */
    status?: number;

    /**
     * How long to wait, counted from when the action returns (default 30 s). One absolute deadline: it covers the
     * request arriving, its response, and reading the body.
     */
    timeout?: number;

    /**
     * Wait for this many requests of the operation (one per uploaded file) and resolve to their bodies, in the order
     * issued. A positive integer. It does not mean "everything the action caused has finished".
     */
    count?: Count;
};

type Result<Body, Count> = Count extends number ? Body[] : Body;
type Act<D, V extends keyof D, R> = D[V] extends (...args: infer A) => unknown ? (...args: A) => Promise<R> : never;

/**
 * The driver's verbs, each performing the action and resolving to the body of the request it waited for. `clickTo`
 * and `pressTo` are not among them: an action that needs both a request and a destination is
 * `Promise.all([waitForApi(page, Api.X), d.clickTo(destination)])`.
 */
export type Settling<D extends AnyDriver, W extends AnyApiOp, Count> = {
    readonly [V in keyof D & SettleVerb]: Act<D, V, Result<BodyOf<W>, Count>>;
};

/**
 * "Do this and wait until the server has answered": performs the verb and waits for the request the spec names,
 * resolving to the response body.
 *
 *     const post = await settle(composer.sendButton, {wait: Api.CreatePost}).click();
 *     await settle(composer.messageTextbox, {wait: Api.CreatePost}).press('Enter');
 *     const files = await settle(composer.fileInput, {wait: Api.UploadFile, count: 2}).chooseFiles(paths);
 *     await settle(modal.saveButton, {wait: Api.PatchChannel, params: {channel_id: channel.id}}).click();
 *
 * A timeout prints the query constraints it expected, if any, and the requests that were seen, by operation and
 * with their query strings: the first 20, then how many were left out (`describeSeen` in api.ts). A part that is
 * `NotRendered` is not a driver and is not accepted. There is no default wait, no list of what an element sends, and no callback form.
 */
export declare function settle<D extends AnyDriver, W extends AnyApiOp, Count extends number | undefined = undefined>(
    driver: D,
    opts: SettleOptions<W, Count>,
): Settling<D, W, Count>;

export type ApiWaitOptions<W extends AnyApiOp> = {
    params?: PathParamsOf<W>;

    /** As for `settle`: decided at registration, before status, body and predicate. */
    query?: QueryFilter;

    /** Only a response whose body satisfies this counts. */
    predicate?: (body: BodyOf<W>, response: Response) => boolean | Promise<boolean>;
    status?: number;

    /** Counted from the call (default 30 s). One absolute deadline covers the body and the predicate. */
    timeout?: number;
};

/**
 * Waits for a request the page sends by itself, or arms a wait before an action. Matching is `settle`'s.
 *
 * Several waits on one action have one form: one or more waiters, all registered first, then exactly one action:
 *
 *     const [job, saved] = await Promise.all([waitForApi(page, Api.CreateJob), settle(save, {wait: Api.PatchChannel}).click()]);
 *     const [post, channel] = await Promise.all([waitForApi(page, Api.CreatePost), send.clickTo(app.channelsPage, params)]);
 *
 * `Promise.all` does not cancel its siblings: if the action fails, a waiter keeps listening until its own deadline
 * and then removes its listener.
 */
export declare function waitForApi<W extends AnyApiOp>(page: Page, op: W, opts?: ApiWaitOptions<W>): Promise<BodyOf<W>>;

// ---------------------------------------------------------------------------------------------------------------------
// expect
// ---------------------------------------------------------------------------------------------------------------------

type LocatorAssertions = ReturnType<typeof playwrightExpect<Locator>>;

type MatcherOptions = {timeout?: number};

/** The matchers over ARIA state. Unchanged, as are the message matchers (`toContainMessage`, `toHaveMessage`). */
export type AriaMatchers = {
    toBeOn(options?: MatcherOptions): Promise<void>;
    toBePressed(options?: MatcherOptions): Promise<void>;
    toBeSelected(options?: MatcherOptions): Promise<void>;
    toBeExpanded(options?: MatcherOptions): Promise<void>;
    toBeSaved(options?: MatcherOptions): Promise<void>;
};

export type ElementAssertions = LocatorAssertions & AriaMatchers & {readonly not: LocatorAssertions['not'] & AriaMatchers};

export type ListAssertions<K> = {
    toHaveKeys(expected: readonly K[], options?: MatcherOptions & {ordered?: boolean}): Promise<void>;
    toContainKeys(expected: readonly K[], options?: MatcherOptions): Promise<void>;
    toHaveKeyCount(count: number, options?: MatcherOptions): Promise<void>;
    readonly not: Omit<ListAssertions<K>, 'not'>;
};

/** `expect(page).toHavePath(ChannelsPage.path(params))`: the page's normalized path equals this one. Retries. */
export type PageAssertions = ReturnType<typeof playwrightExpect<Page>> & {
    toHavePath(path: string, options?: MatcherOptions): Promise<void>;
    readonly not: ReturnType<typeof playwrightExpect<Page>>['not'] & {toHavePath(path: string, options?: MatcherOptions): Promise<void>};
};

type ExpectElement = {

    /**
     * A driver or a scope is asserted on directly, with every locator matcher and the ARIA ones:
     * `await expect(modal.confirmButton).toBeEnabled()`. Specs never reach for `.locator` to assert. A failure ends
     * with the element's testid and component. `NotRendered` is neither, so asserting on a part its mount never
     * renders does not compile.
     *
     * (Generic so that these signatures win over Playwright's own `<T>(actual: T)`, which accepts anything.)
     */
    <E extends AnyDriver | Scope<any> | Locator>(actual: E, messageOrOptions?: string | {message?: string; timeout?: number}): ElementAssertions;
    <L extends KeyedList<any, unknown>>(actual: L, messageOrOptions?: string | {message?: string}): ListAssertions<L extends KeyedList<infer K, unknown> ? K : never>;
    <G extends Page>(actual: G, messageOrOptions?: string | {message?: string; timeout?: number}): PageAssertions;
};

/** Playwright's `expect` without its call signature: `poll`, `extend`, `configure`, the asymmetric matchers. */
type ExpectStatics = {readonly [K in keyof typeof playwrightExpect]: (typeof playwrightExpect)[K]};

/**
 * The lib's `expect`: Playwright's, with drivers, scopes and keyed lists accepted wherever a locator is. Any other
 * value is asserted on as before.
 */
export type SurfaceExpect = ExpectElement &
    (<T>(actual: T, messageOrOptions?: string | {message?: string; timeout?: number}) => ReturnType<typeof playwrightExpect<T>>) &
    Omit<ExpectStatics, 'soft'> & {readonly soft: ExpectElement & (typeof playwrightExpect)['soft']};

export declare const expect: SurfaceExpect;
