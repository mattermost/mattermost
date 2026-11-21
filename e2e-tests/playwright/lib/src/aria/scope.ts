// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';

import type {NotRendered, Part, PartBinding} from './bindings';
import {driverFor, FileInputDriver, type DriverFor} from './drivers';
import {ROLES, keyOfTemplate, keyOfTestId, keyedPattern, type Role} from './grammar';
import {formatMessage, type Message, type ParamsOf} from './msg';

/** What a part's getter returns at a mount that never renders it. Nothing can be called on it. */
export const NOT_RENDERED: NotRendered = Object.freeze({notRendered: true as const});

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A scope's own element: `<scope>`, or `<scope>--<role>` (`channel_settings_modal--dialog`). */
const ownPattern = (scope: string) => new RegExp(`^${escapeRegExp(scope)}(?:--(?:${ROLES.join('|')}))?$`);

const suffixOf = (role: Role | null) => (role ? `--${role}` : '');

/**
 * The component a failure names: the one generated code passes, else the family's class name (a module function, so
 * it takes no member name from generated classes).
 */
const sourceOf = (scope: object, opts?: {source?: string}) => opts?.source ?? scope.constructor.name;

/** The testid of each repeated item's element, so the item's own driver names the item that failed. */
const itemTestIds = new WeakMap<Locator, string>();

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

/**
 * Base of every generated class. `B` is the family's binding at this mount: one property per part (a `PartBinding`),
 * per child (the child family's binding), and `$container` for the scope's own element.
 *
 * Generated code passes each member's binding to the helper, with the type arguments written out
 * (`this.part<'button', B['confirm']>('confirm', 'button', this.bind.confirm)`): TypeScript reads `this.bind.confirm`
 * as the constraint's type, not as `B['confirm']`, so inference would lose the mount. Every return type is written out
 * too; nothing is inferred across files.
 *
 * A generated member may not take a name this class has: `page`, `scope`, `root`, `bind`, `locator`, `part`, `keyed`,
 * `list`, `partList`, `own`, `item`, `fileInput`; nor `container` (the own element's getter), `fill` or `read` (a form's). The scan's
 * `collisions` rule reports a testid that would.
 */
export class Scope<B = unknown> {
    readonly page: Page;

    /** The scope's testid path at this mount: `recaps.recap.delete_modal`. */
    readonly scope: string;

    /** Where members are looked for: the page, or a repeated item's element. */
    readonly root: Locator;
    protected readonly bind: B;
    readonly #element: Locator | undefined;

    /** `element`: the scope's own element when it is not `root.getByTestId(scope)` (a repeated item is its own root). */
    constructor(page: Page, scope: string, bind: B, root?: Locator, element?: Locator) {
        this.page = page;
        this.scope = scope;
        this.bind = bind;
        this.root = root ?? page.locator(':root');
        this.#element = element;
    }

    /** The scope's own element. Matchers take scopes: `expect(app.recaps).toBeVisible()`. */
    get locator(): Locator {
        return this.#element ?? this.root.getByTestId(ownPattern(this.scope));
    }

    /** `<scope>.<name>[--<role>]` */
    protected part<R extends Role | null, P extends PartBinding>(
        name: string,
        role: R,
        binding: P,
        opts?: MemberOptions,
    ): Part<DriverFor<R>, P> {
        if (binding === false) {
            return NOT_RENDERED as Part<DriverFor<R>, P>;
        }
        const testId = `${this.scope}.${name}${suffixOf(role)}`;
        return driverFor(role, this.#base(opts).getByTestId(testId), {
            testId,
            role,
            source: sourceOf(this, opts),
        }) as Part<DriverFor<R>, P>;
    }

    /** `<scope>.<name>`, a native file input (report: `native: 'file'`). */
    protected fileInput<P extends PartBinding>(
        name: string,
        binding: P,
        opts?: MemberOptions,
    ): Part<FileInputDriver, P> {
        if (binding === false) {
            return NOT_RENDERED as Part<FileInputDriver, P>;
        }
        const testId = `${this.scope}.${name}`;
        return new FileInputDriver(this.#base(opts).getByTestId(testId), {
            testId,
            role: null,
            source: sourceOf(this, opts),
        }) as Part<FileInputDriver, P>;
    }

    /** `<scope>.<name>:<key>[--<role>]` */
    protected keyed<R extends Role | null, P extends PartBinding, K extends string | number>(
        name: string,
        role: R,
        key: K,
        binding: P,
        opts?: MemberOptions,
    ): Part<DriverFor<R>, P> {
        if (binding === false) {
            return NOT_RENDERED as Part<DriverFor<R>, P>;
        }
        const testId = `${this.scope}.${name}:${key}${suffixOf(role)}`;
        return driverFor(role, this.#base(opts).getByTestId(testId), {
            testId,
            role,
            source: sourceOf(this, opts),
        }) as Part<DriverFor<R>, P>;
    }

    /** Every `<scope>.<name>:{key}[--<role>]` of a keyed child, as a list by key. */
    protected list<K extends string | number, Item>(
        name: string,
        role: Role | null,
        itemOf: (key: K) => Item,
        opts?: ListOptions,
    ): KeyedList<K, Item> {
        const prefix = `${this.scope}.${name}:`;
        const suffix = suffixOf(role);
        return new KeyedList(this.#base(opts).getByTestId(keyedPattern(prefix, suffix)), itemOf, {
            prefix,
            suffix,
            index: opts?.index,
        });
    }

    /** The same for a keyed part: `NotRendered` at a mount that never renders it. */
    protected partList<K extends string | number, Item, P extends PartBinding>(
        name: string,
        role: Role | null,
        binding: P,
        itemOf: (key: K) => Item,
        opts?: ListOptions,
    ): Part<KeyedList<K, Item>, P> {
        if (binding === false) {
            return NOT_RENDERED as Part<KeyedList<K, Item>, P>;
        }
        return this.list(name, role, itemOf, opts) as Part<KeyedList<K, Item>, P>;
    }

    /** The scope's own element as a driver: `<scope>[--<role>]`, or a repeated item's element. */
    protected own<R extends Role | null, P extends PartBinding>(
        role: R,
        binding: P,
        opts?: {source?: string},
    ): Part<DriverFor<R>, P> {
        if (binding === false) {
            return NOT_RENDERED as Part<DriverFor<R>, P>;
        }
        const element = this.#element;
        const testId = element
            ? (itemTestIds.get(element) ?? `${this.scope}:{key}${suffixOf(role)}`)
            : `${this.scope}${suffixOf(role)}`;
        const locator = element ?? this.root.getByTestId(testId);
        return driverFor(role, locator, {testId, role, source: sourceOf(this, opts)}) as Part<DriverFor<R>, P>;
    }

    /** The element of a repeated child, `<scope>.<name>:<key>[--<role>]`: the child's `root` and own element. */
    protected item(name: string, role: Role | null, key: string | number, opts?: {portal?: true}): Locator {
        const testId = `${this.scope}.${name}:${key}${suffixOf(role)}`;
        const element = this.#base(opts).getByTestId(testId);
        itemTestIds.set(element, testId);
        return element;
    }

    /**
     * Where a member is looked for. A portal's content (a menu, a select's options, a modal opened from an item) renders
     * outside the scope's element, so it is found from the page.
     */
    #base(opts?: {portal?: true}): Locator {
        return opts?.portal ? this.page.locator(':root') : this.root;
    }
}

/** What to find an item by: its text (a substring or a pattern), a catalog message, or an element inside it. */
export type ContentFilter<M extends Message<any> = Message<any>> = {
    text?: string | RegExp;
    message?: M;
    values?: ParamsOf<M>;
    has?: Locator;
};

/** The testid around a list's keys: `<prefix><key><suffix>`; `index` when the keys are positions. */
type KeyTemplate = {prefix: string; suffix: string; index?: true};

const DEFAULT_TIMEOUT = 10_000;

/**
 * The items of a repeated testid (`scope.name:{key}`), by key, in document order. A key can hold any character: it is
 * read exactly, as what lies between the template's prefix and suffix. Matchers retry over it:
 * `await expect(list).toHaveKeys([a.id, b.id])`, `toContainKeys`, `toHaveKeyCount`.
 */
export class KeyedList<K extends string | number = string, Item = Locator> {
    /** The testid pattern, for failure messages: `recaps.recap:{key}`. */
    readonly label: string;
    private readonly template: KeyTemplate | undefined;

    /**
     * @param locator every item's element (a testid pattern locator)
     * @param itemOf the page object for a key
     * @param template the testid around the key, and whether keys are positions; without it, keys are read with the
     *     grammar
     */
    constructor(
        readonly locator: Locator,
        private readonly itemOf: (key: K) => Item,
        template?: KeyTemplate,
    ) {
        this.template = template;
        this.label = template ? `${template.prefix}{key}${template.suffix}` : String(locator);
    }

    /** The item with this key (doesn't wait for it). */
    item(key: K): Item {
        return this.itemOf(key);
    }

    /** The keys of the items shown now, in document order (doesn't wait: assert with the list matchers). */
    async keys(): Promise<K[]> {
        const ids = await this.locator.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
        return ids.map((id) => this.keyOf(id) as K);
    }

    /** The first item, once the list shows at least one. */
    async first(opts: {timeout?: number} = {}): Promise<Item> {
        const keys = await this.waitForKeys((k) => k.length > 0, 'at least one item', opts.timeout);
        return this.itemOf(keys[0]);
    }

    /** The last item, once the list shows at least one (the newest post in a channel). */
    async last(opts: {timeout?: number} = {}): Promise<Item> {
        const keys = await this.waitForKeys((k) => k.length > 0, 'at least one item', opts.timeout);
        return this.itemOf(keys[keys.length - 1]);
    }

    /** The key of the one item matching `filter`; waits until exactly one matches. */
    async keyWith<M extends Message<any>>(filter: ContentFilter<M>, opts: {timeout?: number} = {}): Promise<K> {
        const matching = this.locator.filter(filterOf(filter));
        const deadline = Date.now() + (opts.timeout ?? DEFAULT_TIMEOUT);
        let ids: string[] = [];
        for (;;) {
            ids = await matching.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
            if (ids.length === 1) {
                return this.keyOf(ids[0]) as K;
            }
            if (Date.now() > deadline) {
                break;
            }
            await sleep(100);
        }
        const keys = ids.map((id) => this.keyOf(id));
        throw new Error(
            `${this.label}: expected exactly one item with ${describeFilter(filter)}, found ${ids.length}${keys.length ? ` (${keys.join(', ')})` : ''}; the list has ${(await this.keys()).length} items`,
        );
    }

    /** The one item matching `filter`; waits until exactly one matches. */
    async itemWith<M extends Message<any>>(filter: ContentFilter<M>, opts: {timeout?: number} = {}): Promise<Item> {
        return this.itemOf(await this.keyWith(filter, opts));
    }

    /** The key of an item's testid: a number when the keys are positions (never guessed from the text: an id can be all digits). */
    private keyOf(testId: string): string | number {
        const key = this.template
            ? keyOfTemplate(testId, this.template.prefix, this.template.suffix)
            : keyOfTestId(testId);
        if (key === null) {
            return testId;
        }
        return this.template?.index ? Number(key) : key;
    }

    private async waitForKeys(ok: (keys: K[]) => boolean, what: string, timeout = DEFAULT_TIMEOUT): Promise<K[]> {
        const deadline = Date.now() + timeout;
        for (;;) {
            const keys = await this.keys();
            if (ok(keys)) {
                return keys;
            }
            if (Date.now() > deadline) {
                throw new Error(`${this.label}: expected ${what} within ${timeout} ms, found ${keys.length}`);
            }
            await sleep(100);
        }
    }
}

/** An entity or its key: `{id: 'abc'}` or `'abc'` -> `'abc'`. */
export function keyOf<T extends object, F extends keyof T>(value: Pick<T, F> | string, field: F): string {
    return typeof value === 'string' ? value : String(value[field]);
}

/** The key of a keyed element found some other way (a list item filtered by its text). */
export async function keyOfElement(element: Locator): Promise<string> {
    const testId = await element.getAttribute('data-testid');
    const key = testId ? keyOfTestId(testId) : null;
    if (key === null) {
        throw new Error(`${String(element)} has no keyed testid to read a key from`);
    }
    return key;
}

/**
 * A CSS selector for a generated element, for the APIs that take selectors rather than locators (axe's `include()`,
 * scripts that run in the page): a driver or a scope by its testid, or every item of a keyed list, optionally only the
 * items rendered as `tag`.
 */
export function testIdSelector(
    target: {meta: {testId: string}} | Scope | KeyedList<string | number, unknown>,
    opts: {tag?: string} = {},
): string {
    const tag = opts.tag ?? '';
    const quote = (s: string) => s.replace(/["\\]/g, '\\$&');
    if (target instanceof KeyedList) {
        const [prefix, suffix] = target.label.split('{key}');
        if (suffix === undefined) {
            throw new Error(`${target.label} is not a keyed testid pattern`);
        }
        return `${tag}[data-testid^="${quote(prefix)}"]${suffix ? `[data-testid$="${quote(suffix)}"]` : ''}`;
    }
    return `${tag}[data-testid="${quote(target instanceof Scope ? target.scope : target.meta.testId)}"]`;
}

function filterOf(filter: ContentFilter): {hasText?: string | RegExp; has?: Locator} {
    const hasText = filter.message ? formatMessage(filter.message, filter.values) : filter.text;
    return {...(hasText === undefined ? {} : {hasText}), ...(filter.has ? {has: filter.has} : {})};
}

function describeFilter(filter: ContentFilter): string {
    if (filter.message) {
        return `message ${filter.message.id} ("${formatMessage(filter.message, filter.values)}")`;
    }
    if (filter.text !== undefined) {
        return `text ${typeof filter.text === 'string' ? `"${filter.text}"` : String(filter.text)}`;
    }
    return filter.has ? `an element ${String(filter.has)}` : 'no filter';
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
