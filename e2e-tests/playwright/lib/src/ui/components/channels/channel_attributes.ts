// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The test-id suffix of a chip strip. The channel header renders the header and
 * info designations as one merged strip, 'info-header'.
 */
export type ChannelAttributeSurface = 'header' | 'info' | 'info-header';

/**
 * The attribute chips in one channel header slot.
 */
export class ChannelAttributeLabels {
    readonly container: Locator;
    readonly surface: ChannelAttributeSurface;

    constructor(container: Locator, surface: ChannelAttributeSurface) {
        this.container = container;
        this.surface = surface;
    }

    get chips() {
        return this.container.getByTestId('attributeChip');
    }

    chip(value: string) {
        return this.chips.filter({hasText: value});
    }

    get overflowButton() {
        return this.container.getByTestId(`channelAttributeLabelsOverflow-${this.surface}`);
    }

    get popover() {
        return this.container.page().getByTestId(`channelAttributeLabelsPopover-${this.surface}`);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeHidden() {
        await expect(this.container).toHaveCount(0);
    }

    get visibleRow(): Locator {
        return this.container.locator('.ChannelAttributeLabels__visible');
    }

    async openOverflow() {
        await this.overflowButton.click();
        await expect(this.popover).toBeVisible();
        return this.popover;
    }
}

/**
 * The Channel Attributes block in the Channel Info panel, including its inline editors.
 * Locators key off the machine name, which is what the product puts in every test id.
 */
export class ChannelInfoAttributes {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    row(name: string) {
        return this.container.getByTestId(`channelInfoAttributeRow-${name}`);
    }

    /**
     * The displayed value. An editable text value renders as plain text inside its
     * edit button; every other value, and a read-only text one, renders as a chip.
     */
    chip(name: string) {
        return this.row(name)
            .getByTestId('attributeChip')
            .or(this.editButton(name).locator('.ChannelInfoAttributes__textValue'));
    }

    editButton(name: string) {
        return this.row(name).getByTestId(`channelInfoAttributeEdit-${name}`);
    }

    // Page-wide: a select's options render in a menu portalled to the body, outside
    // the row. The test id is unique either way.
    editor(name: string) {
        return this.container.page().getByTestId(`channelAttributeEdit-${name}`);
    }

    error(name: string) {
        return this.container.getByTestId(`channelInfoAttributeError-${name}`);
    }

    lock(name: string) {
        return this.container.getByTestId(`channelInfoAttributeLock-${name}`);
    }

    unset(name: string) {
        return this.container.getByTestId(`channelInfoAttributeUnset-${name}`);
    }

    get addButton() {
        return this.container.getByTestId('channelInfoAddAttributeButton');
    }

    addMenuItem(name: string) {
        return this.container.page().getByTestId(`channelInfoAddAttribute-${name}`);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async startEditing(name: string) {
        await this.editButton(name).click();
        await expect(this.editor(name)).toBeVisible();
    }

    /**
     * Only Escape is guaranteed to close the editor: a commit closes it on a
     * successful write and deliberately keeps it open on a failed one, so callers
     * assert the outcome they expect.
     */
    async setText(name: string, text: string, commit: 'enter' | 'blur' | 'escape' = 'enter') {
        await this.startEditing(name);

        const input = this.editor(name);
        await input.fill(text);

        if (commit === 'enter') {
            await input.press('Enter');
        } else if (commit === 'escape') {
            await input.press('Escape');
            await expect(input).not.toBeVisible();
        } else {
            await this.container
                .page()
                .locator('body')
                .click({position: {x: 0, y: 0}});
        }
    }

    /**
     * editor(name) on a select field is the first menu option, not a combobox, so
     * clicking it would pick that option. Options are picked by name instead.
     */
    async select(name: string, option: string) {
        await this.startEditing(name);
        await this.pickOption(option);
    }

    async pickOption(option: string) {
        await this.container.page().getByRole('menuitem', {name: option, exact: true}).click();
    }

    /**
     * The trigger's own chip carries the remove control -- no need to reopen
     * the menu first, and removing does not open it either.
     */
    async deselect(name: string, option: string) {
        await this.row(name)
            .getByRole('button', {name: `Remove ${option}`})
            .click();
    }

    /**
     * A text attribute opens its input as soon as it is added; a select one lands as
     * a closed "Not set" row, so its menu is opened here.
     */
    async add(name: string, option?: string) {
        await this.addButton.click();
        await this.addMenuItem(name).click();
        await expect(this.editor(name).or(this.unset(name))).toBeVisible();
        if (!(await this.editor(name).isVisible())) {
            await this.editButton(name).click();
        }
        await expect(this.editor(name)).toBeVisible();

        if (option !== undefined) {
            await this.pickOption(option);
        }
    }
}
