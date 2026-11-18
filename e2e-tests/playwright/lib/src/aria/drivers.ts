// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect as baseExpect} from '@playwright/test';

import type {Meta} from './bindings';
import {arrive, type ToOptions} from './destinations';
import type {Role} from './grammar';
import type {ParamsOf, ReadyPage} from './pages';
import type {Scope} from './scope';

/** How long `choose` waits for a matching option to show before listing the ones it found. */
const OPTION_TIMEOUT = 10_000;

/**
 * A driver operates one ARIA pattern on one element. Every method named in `VERBS` performs its action and resolves
 * to nothing: it does not wait for requests (`settle(driver, {wait})` does) and it predicts no destination (`clickTo`
 * and `pressTo` take one).
 *
 * Drivers read state from ARIA attributes, never from CSS classes. They don't wait before acting (Playwright's actions
 * wait for the element), but a method that sets state (`set`, `setPressed`) checks the state changed, and every failure
 * names the element's testid and the component that renders it.
 */
export class Driver {
    readonly locator: Locator;
    readonly meta: Meta;

    constructor(locator: Locator, meta: Meta) {
        this.locator = locator;
        this.meta = meta;
    }

    get page(): Page {
        return this.locator.page();
    }

    isVisible(): Promise<boolean> {
        return this.locator.isVisible();
    }

    async isDisabled(): Promise<boolean> {
        if (await this.locator.isDisabled()) {
            return true;
        }
        return (await this.locator.getAttribute('aria-disabled')) === 'true';
    }

    scrollIntoView(): Promise<void> {
        return this.step(() => this.locator.scrollIntoViewIfNeeded());
    }

    hover(): Promise<void> {
        return this.step(() => this.locator.hover());
    }

    focus(): Promise<void> {
        return this.step(() => this.locator.focus());
    }

    blur(): Promise<void> {
        return this.step(() => this.locator.blur());
    }

    /**
     * Presses a key or a chord (`Control+Enter`) with the element focused. With more keys, a key SEQUENCE as one
     * action: the element is focused once, then every key goes to whatever has focus, in order, as a user's keyboard
     * does. (Two separate `press` calls each refocus their own element first.)
     */
    press(key: string, ...moreKeys: string[]): Promise<void> {
        return this.step(async () => {
            await this.locator.press(key);
            for (const next of moreKeys) {
                await this.page.keyboard.press(next);
            }
        });
    }

    /**
     * Presses ONE key or chord and arrives: `pressTo('Enter', app.searchResults)`. Exactly `clickTo`'s contract, with
     * the press in place of the click.
     */
    pressTo<T extends Destination>(key: string, destination: T, opts?: ToOptions): Promise<T>;
    pressTo<P extends ReadyPage>(key: string, destination: P, params: ParamsOf<P>, opts?: ToOptions): Promise<P>;
    pressTo(key: string, destination: unknown, ...rest: unknown[]): Promise<unknown> {
        return arrive(
            this,
            `pressing ${key}`,
            (timeout) => this.step(() => this.locator.press(key, {timeout})),
            destination,
            rest,
        );
    }

    /** Runs a step on the element; a failure says which element (its testid and source). */
    protected async step<T>(step: () => Promise<T>): Promise<T> {
        try {
            return await step();
        } catch (e) {
            throw withElement(e, this.meta);
        }
    }
}

/** What failures say about an element. */
export type ElementInfo = Pick<Meta, 'testId' | 'source'>;

/**
 * Adds the element's testid and source to an error (once), keeping its type and stack. For drivers, matchers and
 * page objects that report on an element.
 */
export function withElement(e: unknown, meta: ElementInfo): unknown {
    if (!(e instanceof Error)) {
        return e;
    }
    const line = elementLine(meta);
    if (!e.message.includes(line)) {
        const before = e.message;
        e.message = `${before}\n${line}`;
        if (e.stack?.includes(before)) {
            e.stack = e.stack.replace(before, e.message);
        }
    }
    return e;
}

/** `  element: center.post_create.send--button (AdvancedCreatePost)` */
export function elementLine(meta: ElementInfo): string {
    return `  element: ${meta.testId} (${meta.source})`;
}

/**
 * Playwright's click options (`{button: 'right'}`, `{modifiers: ['Alt']}`, `{position}`), without `force`, which skips
 * the checks that the element can take the click, and `trial`, a click that doesn't click.
 */
export type ClickOptions = Omit<NonNullable<Parameters<Locator['click']>[0]>, 'force' | 'trial'>;

/** A driver whose element is clicked: buttons, links and menu items, and text and containers (a post, a row). */
export class ClickableDriver extends Driver {
    click(options?: ClickOptions): Promise<void> {
        return this.step(() => this.locator.click(options));
    }

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
    clickTo(destination: unknown, ...rest: unknown[]): Promise<unknown> {
        return arrive(this, 'clicking', (timeout) => this.step(() => this.locator.click({timeout})), destination, rest);
    }
}

/** An element without a role: a region of the page. */
export class ContainerDriver extends ClickableDriver {}

/** button, link, menuitem: things you click. */
export class ButtonDriver extends ClickableDriver {}

/**
 * A native `<input type="file">` (report: `native: 'file'`). It has its own testid; nothing follows a button to it.
 * Uploads are sent on the input's `change`, so this is the action to settle:
 * `settle(composer.fileInput, {wait: Api.UploadFile, count: 2}).chooseFiles(paths)`.
 */
export class FileInputDriver extends Driver {
    chooseFiles(paths: string | readonly string[]): Promise<void> {
        const files = typeof paths === 'string' ? [paths] : [...paths];
        return this.step(() => this.locator.setInputFiles(files));
    }
}

export class LinkDriver extends ButtonDriver {
    href(): Promise<string | null> {
        return this.locator.getAttribute('href');
    }
}

export class MenuitemDriver extends ButtonDriver {}

/** menuitemcheckbox / menuitemradio: a menu item with aria-checked. */
export class MenuitemCheckDriver extends ButtonDriver {
    async isChecked(): Promise<boolean> {
        return (await this.locator.getAttribute('aria-checked')) === 'true';
    }
}

/** A button with aria-pressed. */
export class TogglebuttonDriver extends Driver {
    async isPressed(): Promise<boolean> {
        return (await this.locator.getAttribute('aria-pressed')) === 'true';
    }

    /** Clicks only when it isn't already in the wanted state, then checks it is. */
    setPressed(on = true): Promise<void> {
        return this.step(async () => {
            if ((await this.isPressed()) !== on) {
                await this.locator.click();
            }
            await baseExpect(this.locator, `${this.meta.testId} pressed=${on}`).toHaveAttribute(
                'aria-pressed',
                String(on),
            );
        });
    }

    /** One click, whatever the state. */
    toggle(): Promise<void> {
        return this.step(() => this.locator.click());
    }
}

/** role="switch": aria-checked, or a native checkbox's checked state. */
export class SwitchDriver extends Driver {
    isOn(): Promise<boolean> {
        return this.locator.isChecked();
    }

    /** Flips the switch only when it isn't already in the wanted state, then checks it is. */
    set(on: boolean): Promise<void> {
        return this.step(async () => {
            if ((await this.isOn()) !== on) {
                await this.flip();
            }
            await baseExpect(this.locator, `${this.meta.testId} on=${on}`).toBeChecked({checked: on});
        });
    }

    /** Flips the switch, whatever its state (doesn't check the result: use `set` for a known end state). */
    toggle(): Promise<void> {
        return this.step(() => this.flip());
    }

    /**
     * A native switch is often a visually hidden input inside its <label>, or beside a <label for> (compass's Switch),
     * and the label takes the pointer.
     */
    private async flip(): Promise<void> {
        const label = this.locator.locator('xpath=ancestor::label[1]');
        if (await label.count()) {
            await label.click();
            return;
        }
        const id = await this.locator.getAttribute('id');
        const labelFor = id ? this.page.locator(`label[for="${cssString(id)}"]`) : null;
        if (labelFor && (await labelFor.count())) {
            await labelFor.click();
        } else {
            await this.locator.click();
        }
    }
}

/** Native checkbox or role="checkbox". `check`, `uncheck` and `set` check the state changed (Playwright's do). */
export class CheckboxDriver extends Driver {
    isChecked(): Promise<boolean> {
        return this.locator.isChecked();
    }

    check(): Promise<void> {
        return this.step(() => this.locator.check());
    }

    uncheck(): Promise<void> {
        return this.step(() => this.locator.uncheck());
    }

    set(checked: boolean): Promise<void> {
        return this.step(() => this.locator.setChecked(checked));
    }
}

export class RadioDriver extends CheckboxDriver {}

/** role="radiogroup": one of its radios, by accessible name. */
export class RadiogroupDriver extends Driver {
    /** A radio of the group by its accessible name (exact for a string). */
    radio(option: string | RegExp): Locator {
        return this.locator.getByRole('radio', {name: option, exact: typeof option === 'string'});
    }

    /** Checks the radio named `option` (and that it's checked); lists the radios when none matches. */
    choose(option: string | RegExp): Promise<void> {
        return this.step(async () => {
            const radio = this.radio(option);
            try {
                await radio.waitFor({state: 'attached', timeout: OPTION_TIMEOUT});
            } catch {
                const names = await this.locator
                    .getByRole('radio')
                    .evaluateAll((els) =>
                        els.map(
                            (el) =>
                                el.getAttribute('aria-label') ??
                                el.closest('label')?.textContent ??
                                el.getAttribute('value') ??
                                '',
                        ),
                    );
                throw new Error(
                    `choose: no radio of "${this.meta.testId}" matches ${String(option)}; radios: ${listOf(names)}`,
                );
            }
            await radio.check();
        });
    }

    /** Whether the radio named `option` is checked. */
    isChosen(option: string | RegExp): Promise<boolean> {
        return this.radio(option).isChecked();
    }
}

/** textbox / searchbox / spinbutton: inputs, textareas and contenteditable editors. */
export class TextboxDriver extends Driver {
    fill(value: string): Promise<void> {
        return this.step(() => this.locator.fill(value));
    }

    clear(): Promise<void> {
        return this.step(() => this.locator.clear());
    }

    /** Types like a user, a key at a time, for inputs that react to keystrokes. */
    type(value: string): Promise<void> {
        return this.step(() => this.locator.pressSequentially(value));
    }

    async value(): Promise<string> {
        const editable = await this.locator.getAttribute('contenteditable');
        return editable === 'true' ? this.locator.innerText() : this.locator.inputValue();
    }
}

/** role="tab" with aria-selected. */
export class TabDriver extends Driver {
    select(): Promise<void> {
        return this.step(() => this.locator.click());
    }

    async isSelected(): Promise<boolean> {
        return (await this.locator.getAttribute('aria-selected')) === 'true';
    }
}

/** combobox / listbox: choose an option by its visible text. */
export class ComboboxDriver extends Driver {
    choose(option: string | RegExp): Promise<void> {
        return this.step(async () => {
            if (await this.locator.evaluate((el) => el.tagName === 'SELECT')) {
                await this.chooseNative(option);
                return;
            }

            // Open the list from the keyboard rather than by clicking: a select's placeholder (react-select) can sit
            // over its input and take the click. A listbox is already open. The input is the element's own, or one
            // inside it when the testid is on a wrapper (react-select's container).
            if (this.meta.role !== 'listbox') {
                const target = await this.input();
                if ((await target.getAttribute('aria-expanded')) !== 'true' && !(await this.isExpanded())) {
                    await target.focus();
                    await target.press('ArrowDown');
                }
            }

            // The options of this element's own list: a listbox's children, or the list its aria-controls names
            // (react-select renders it in a portal). Only the visible ones: another select on the page can hold a
            // native <option> with the same text. Without aria-controls, the first visible match on the page.
            const host = await this.optionsHost();
            const matching = (host ?? this.page.locator(':root'))
                .getByRole('option', {name: option, exact: typeof option === 'string'})
                .filter({visible: true});
            const target = host ? matching : matching.first();
            try {
                await target.first().waitFor({state: 'visible', timeout: OPTION_TIMEOUT});
            } catch {
                const labels = await (host ?? this.page.locator(':root'))
                    .getByRole('option')
                    .filter({visible: true})
                    .allInnerTexts();
                throw new Error(
                    `choose: no option of "${this.meta.testId}" matches ${String(option)}; options: ${listOf(labels)}`,
                );
            }
            await target.click();
        });
    }

    /** Types into the combobox's input to filter its options (or to name a new one in a creatable select). */
    fill(value: string): Promise<void> {
        return this.step(async () => (await this.input()).fill(value));
    }

    clear(): Promise<void> {
        return this.step(async () => (await this.input()).clear());
    }

    /** Types into the combobox's input like a user, a key at a time, for selects that search as you type. */
    type(value: string): Promise<void> {
        return this.step(async () => (await this.input()).pressSequentially(value));
    }

    async isExpanded(): Promise<boolean> {
        return (await this.locator.getAttribute('aria-expanded')) === 'true';
    }

    /** The element's input: its own, or one inside it when the testid is on a wrapper (react-select's container). */
    private async input(): Promise<Locator> {
        const input = this.locator.locator('xpath=descendant-or-self::*[self::input or @role="combobox"]').first();
        return (await input.count()) ? input : this.locator;
    }

    /** A native <select>: pick by label (it has no clickable options). */
    private async chooseNative(option: string | RegExp): Promise<void> {
        if (typeof option === 'string') {
            await this.locator.selectOption({label: option});
            return;
        }

        // options can load after the select renders: look for a match for a while before giving up
        const deadline = Date.now() + OPTION_TIMEOUT;
        for (;;) {
            const labels = (await this.locator.locator('option').allInnerTexts()).map((text) => text.trim());
            const label = labels.find((text) => option.test(text));
            if (label !== undefined) {
                await this.locator.selectOption({label});
                return;
            }
            if (Date.now() > deadline) {
                throw new Error(
                    `choose: no option of "${this.meta.testId}" matches ${String(option)}; options: ${listOf(labels)}`,
                );
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    /** The element that holds this element's options, or null when it doesn't say (no aria-controls/aria-owns). */
    private async optionsHost(): Promise<Locator | null> {
        if (this.meta.role === 'listbox' || (await this.locator.getAttribute('role')) === 'listbox') {
            return this.locator;
        }

        // on the element, or on its input when the testid is on a wrapper (react-select's container)
        const owner = this.locator
            .locator('xpath=self::*[@aria-controls or @aria-owns] | descendant::*[@aria-controls or @aria-owns]')
            .first();
        try {
            // react-select sets aria-controls once the menu is open, a render after the key press
            await owner.waitFor({state: 'attached', timeout: 1000});
        } catch {
            return null;
        }
        const id = (await owner.getAttribute('aria-controls')) || (await owner.getAttribute('aria-owns'));
        const first = id?.trim().split(/\s+/)[0];
        return first ? this.page.locator(`[id="${cssString(first)}"]`) : null;
    }
}

/** Content (`--text`) and every role the runtime reads but doesn't otherwise operate: read, or clicked. */
export class TextDriver extends ClickableDriver {
    text(): Promise<string> {
        return this.step(() => this.locator.innerText());
    }

    /** The text, or `null` when the element isn't rendered (doesn't wait for it). */
    async textIfPresent(): Promise<string | null> {
        return (await this.locator.count()) ? this.locator.innerText() : null;
    }
}

/** role="option" in a listbox or a select's menu: read like text, and selected by clicking. */
export class OptionDriver extends TextDriver {
    select(): Promise<void> {
        return this.step(() => this.locator.click());
    }

    async isSelected(): Promise<boolean> {
        return (await this.locator.getAttribute('aria-selected')) === 'true';
    }
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
    group: TextDriver;
    separator: TextDriver;
} extends infer Table extends Record<Role, Driver>
    ? Table
    : never;

export type DriverFor<R extends Role | null> = R extends Role ? RoleDrivers[R] : ContainerDriver;

/**
 * Something an action can lead to on the same browser page: an element, or a scope that has an element of its own to
 * wait for (its generated `container`). A scope that only names a testid prefix (no element carries the scope itself)
 * never arrives, so it is not a destination; neither is a `NotRendered` part or a scope whose own element is not
 * rendered at this mount. Target one of its members instead.
 */
export type Destination = RootedScope | AnyDriver;

/** A scope whose own element is rendered: the generator gives it a `container` driver. */
export type RootedScope = Scope<any> & {readonly container: AnyDriver};

/** Any driver. */
export type AnyDriver = {readonly locator: Locator; readonly meta: Meta};

type DriverClass = new (locator: Locator, meta: Meta) => Driver;

/** The class of each role, at run time. `satisfies` keeps it total over the grammar's roles. */
const ROLE_CLASSES = {
    button: ButtonDriver,
    link: LinkDriver,
    textbox: TextboxDriver,
    searchbox: TextboxDriver,
    checkbox: CheckboxDriver,
    switch: SwitchDriver,
    radio: RadioDriver,
    radiogroup: RadiogroupDriver,
    combobox: ComboboxDriver,
    listbox: ComboboxDriver,
    option: OptionDriver,
    tab: TabDriver,
    tablist: TextDriver,
    tabpanel: TextDriver,
    menu: TextDriver,
    menuitem: MenuitemDriver,
    menuitemcheckbox: MenuitemCheckDriver,
    menuitemradio: MenuitemCheckDriver,
    dialog: TextDriver,
    alertdialog: TextDriver,
    slider: TextDriver,
    spinbutton: TextboxDriver,
    togglebutton: TogglebuttonDriver,
    text: TextDriver,
    img: TextDriver,
    list: TextDriver,
    listitem: TextDriver,
    row: TextDriver,
    grid: TextDriver,
    gridcell: TextDriver,
    status: TextDriver,
    alert: TextDriver,
    tooltip: TextDriver,
    region: TextDriver,
    group: TextDriver,
    separator: TextDriver,
} satisfies Record<Role, DriverClass>;

/** The driver for an element of `role` (a container when it has none). */
export function driverFor<R extends Role | null>(role: R, locator: Locator, meta: Meta): DriverFor<R> {
    const Class: DriverClass = role ? ROLE_CLASSES[role] : ContainerDriver;
    return new Class(locator, meta) as unknown as DriverFor<R>;
}

/** A string inside a CSS attribute selector's double quotes. */
function cssString(s: string): string {
    return s.replace(/["\\]/g, '\\$&');
}

function listOf(labels: string[]): string {
    const names = labels.map((l) => l.trim()).filter(Boolean);
    return names.length ? names.map((l) => `"${l}"`).join(', ') : '(none visible)';
}
