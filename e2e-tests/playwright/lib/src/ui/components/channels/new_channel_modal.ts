// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import Switch from '../switch';

export default class NewChannelModal {
    readonly container: Locator;

    readonly displayNameInput: Locator;
    readonly urlSection: Locator;
    readonly purposeInput: Locator;
    readonly publicTypeButton: Locator;
    readonly privateTypeButton: Locator;
    readonly createButton: Locator;
    readonly cancelButton: Locator;
    readonly classificationSwitch: Switch;

    constructor(container: Locator) {
        this.container = container;

        this.displayNameInput = container.getByLabel('Channel name');
        this.urlSection = container.getByTestId('urlInputLabel');
        this.purposeInput = container.locator('#new-channel-modal-purpose');
        this.publicTypeButton = container.locator('#public-private-selector-button-O');
        this.privateTypeButton = container.locator('#public-private-selector-button-P');
        this.createButton = container.getByRole('button', {name: 'Create channel'});
        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
        this.classificationSwitch = new Switch(container, 'channelClassificationToggle-button');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async fillDisplayName(name: string) {
        await this.displayNameInput.fill(name);
        await this.displayNameInput.press('Tab');
    }

    async enableClassification() {
        await this.classificationSwitch.check();
    }

    async create() {
        await this.createButton.click();
    }

    async cancel() {
        await this.cancelButton.click();
    }

    getAttributeRow(fieldName: string): Locator {
        return this.container.getByTestId(`channelAttributeRow-${fieldName}`);
    }

    getAttributeCombobox(fieldName: string): Locator {
        return this.getAttributeRow(fieldName).getByTestId(`channelAttribute-${fieldName}`);
    }

    // The menu is portaled out of the modal, so it is reached through the input's aria-controls.
    async getAttributeListbox(fieldName: string): Promise<Locator> {
        const listboxId = await this.getAttributeCombobox(fieldName).getAttribute('aria-controls');
        if (!listboxId) {
            throw new Error(`Attribute combobox "${fieldName}" has no aria-controls`);
        }
        return this.container.page().locator(`#${listboxId}`);
    }

    // Opens by click: focus alone doesn't open the menu.
    async openAttributeCombobox(fieldName: string): Promise<Locator> {
        const combobox = this.getAttributeCombobox(fieldName);
        await combobox.click();
        await expect(combobox).toHaveAttribute('aria-expanded', 'true');
        return this.getAttributeListbox(fieldName);
    }

    getAttributeOption(fieldName: string, optionId: string): Locator {
        return this.container.page().getByTestId(`channelAttribute-${fieldName}-option-${optionId}`);
    }

    /**
     * Opens the combobox and picks an option by its exact label. The label span is matched rather
     * than the option's accessible name, which carries "Rank n" on ranked options. The menu closes
     * after the pick; in a multiselect, picking an already selected option deselects it.
     */
    async selectAttributeOption(fieldName: string, optionName: string): Promise<void> {
        const listbox = await this.openAttributeCombobox(fieldName);
        await listbox
            .getByRole('option')
            .filter({has: listbox.page().getByText(optionName, {exact: true})})
            .click();
        await expect(this.getAttributeCombobox(fieldName)).toHaveAttribute('aria-expanded', 'false');
    }

    /** Asserts the open menu lists exactly these option ids, in this order. */
    async expectAttributeOptionOrder(fieldName: string, optionIds: string[]): Promise<void> {
        const options = (await this.getAttributeListbox(fieldName)).getByRole('option');
        await expect(options).toHaveCount(optionIds.length);
        for (const [index, optionId] of optionIds.entries()) {
            await expect(options.nth(index)).toHaveAttribute(
                'data-testid',
                `channelAttribute-${fieldName}-option-${optionId}`,
            );
        }
    }

    getAttributeClearButton(fieldName: string): Locator {
        return this.getAttributeRow(fieldName).getByTestId(`channelAttribute-${fieldName}-clear`);
    }

    getAttributeChips(fieldName: string): Locator {
        return this.getAttributeRow(fieldName).locator('[data-chip]');
    }

    getAttributeError(fieldName: string): Locator {
        return this.getAttributeRow(fieldName).getByRole('alert');
    }
}
