// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export const GLOBAL_ATTRIBUTES_PATH = '/admin_console/system_attributes/manage_attributes';
export const ATTRIBUTE_DETAILS_PATH = `${GLOBAL_ATTRIBUTES_PATH}/attribute_details`;

export type ChannelDisplayLocation = 'display_label_header' | 'display_label_info' | 'display_banner_top';

async function setToggle(toggle: Locator, on: boolean) {
    if (((await toggle.getAttribute('aria-pressed')) === 'true') !== on) {
        await toggle.click();
    }
}

/**
 * The Channels row of an attribute's "Applies to" card.
 */
export class AppliesToChannels {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    get addResourceButton() {
        return this.container.getByTestId('appliesToAddResource');
    }

    get row() {
        return this.container.getByTestId('channelsResourceRow');
    }

    get summary() {
        return this.container.getByTestId('channelsResourceRowSummary');
    }

    get requiredToggle() {
        return this.container.getByTestId('channelsResourceRequired-button');
    }

    get allowChangesToggle() {
        return this.container.getByTestId('channelsResourceEditable-button');
    }

    location(location: ChannelDisplayLocation) {
        return this.container.getByTestId(`channelsResourceLocation-${location}`);
    }

    get setterButton() {
        return this.container.getByTestId('channelsResourceSetterButton');
    }

    async addResource() {
        await this.addResourceButton.click();
        await expect(this.row).toBeVisible();
    }

    async setRequired(required: boolean) {
        await setToggle(this.requiredToggle, required);
    }

    async setAllowChanges(allowed: boolean) {
        await setToggle(this.allowChangesToggle, allowed);
    }

    async setDisplayLocations(locations: ChannelDisplayLocation[]) {
        for (const location of locations) {
            await this.location(location).check();
        }
    }

    /**
     * @param setter the menu label, e.g. 'Any member' or 'Channel admin'
     */
    async setSetter(setter: string) {
        await this.setterButton.click();
        await this.container.page().getByRole('menuitemradio', {name: setter, exact: true}).click();
    }
}

/**
 * The Global Attributes pages in the System Console: the attribute list and the
 * New attribute form.
 */
export default class GlobalAttributes {
    readonly container: Locator;
    readonly appliesToChannels: AppliesToChannels;

    constructor(container: Locator) {
        this.container = container;
        this.appliesToChannels = new AppliesToChannels(container);
    }

    get displayNameInput() {
        return this.container.getByTestId('attributeDisplayNameInput');
    }

    get typeMenuButton() {
        return this.container.getByTestId('attributeTypeMenuButton');
    }

    get optionsInput() {
        return this.container.getByTestId('attributeOptionsValues__addInput');
    }

    get saveButton() {
        return this.container.getByTestId('saveSetting');
    }

    async gotoNewAttribute() {
        await this.container.page().goto(ATTRIBUTE_DETAILS_PATH);
        await expect(this.displayNameInput).toBeVisible();
    }

    async setDisplayName(displayName: string) {
        await this.displayNameInput.fill(displayName);
    }

    /**
     * @param type the menu label, e.g. 'Select'. Matched exactly, because
     * 'Select' is also a substring of 'Multiselect'.
     */
    async selectType(type: string) {
        await this.typeMenuButton.click();
        await this.container.page().getByRole('menuitemradio', {name: type, exact: true}).click();
    }

    async addOptions(options: string[]) {
        for (const option of options) {
            await this.optionsInput.fill(option);
            await this.optionsInput.press('Enter');
        }
    }

    async save() {
        await this.saveButton.click();
        await expect(this.container.page()).toHaveURL(/manage_attributes$/);
    }
}
