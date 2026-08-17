// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The attribute chips in the channel header.
 */
export class ChannelAttributeLabels {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    get chips() {
        return this.container.getByTestId('attributeChip');
    }

    chip(value: string) {
        return this.chips.filter({hasText: value});
    }

    get overflowButton() {
        return this.container.getByTestId('channelAttributeLabelsOverflow');
    }

    get popover() {
        return this.container.page().getByTestId('channelAttributeLabelsPopover');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
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

    chip(name: string) {
        return this.row(name).getByTestId('attributeChip');
    }

    editButton(name: string) {
        return this.row(name).getByTestId(`channelInfoAttributeEdit-${name}`);
    }

    editor(name: string) {
        return this.row(name).getByTestId(`channelAttributeEdit-${name}`);
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
            await this.container.page().locator('body').click({position: {x: 0, y: 0}});
        }
    }

    async select(name: string, option: string) {
        await this.startEditing(name);
        await this.editor(name).click();
        await this.container.page().getByText(option, {exact: true}).click();
    }

    /**
     * Reopens the editor first: each pick commits and closes it.
     */
    async deselect(name: string, option: string) {
        await this.startEditing(name);

        const chip = this.editor(name).locator('.DropDown__multi-value', {hasText: option});
        await chip.locator('.DropDown__multi-value__remove').click();
    }

    async add(name: string, option?: string) {
        await this.addButton.click();
        await this.addMenuItem(name).click();
        await expect(this.editor(name)).toBeVisible();

        if (option !== undefined) {
            await this.editor(name).click();
            await this.container.page().getByText(option, {exact: true}).click();
        }
    }
}
