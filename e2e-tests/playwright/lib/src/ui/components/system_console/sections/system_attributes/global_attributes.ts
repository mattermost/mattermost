// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import ChannelsWithoutValueModal from './channels_without_value_modal';
import NotifyChannelAdminsModal from './notify_channel_admins_modal';

export const GLOBAL_ATTRIBUTES_PATH = '/admin_console/system_attributes/manage_attributes';
export const ATTRIBUTE_DETAILS_PATH = `${GLOBAL_ATTRIBUTES_PATH}/attribute_details`;
export const CLASSIFICATION_ATTRIBUTE_PATH = `${GLOBAL_ATTRIBUTES_PATH}/classification`;

export type ChannelDisplayLocation = 'display_label_header' | 'display_label_info' | 'display_banner_top';

async function setToggle(toggle: Locator, on: boolean) {
    if ((await toggle.isChecked()) !== on) {
        await toggle.click();
    }
}

/**
 * The channel settings themselves — required, display locations, change policy.
 * Two pages host them, each with its own chrome around this body.
 */
class ChannelResourceSettings {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    get requiredToggle() {
        return this.container.getByTestId('channelsResourceRequired-button');
    }

    get changePolicyButton() {
        return this.container.getByTestId('channelsResourceChangePolicyButton');
    }

    location(location: ChannelDisplayLocation) {
        return this.container.getByTestId(`channelsResourceLocation-${location}`);
    }

    /**
     * The missing-values banner (MM-70717). Not shown at all while every
     * active channel already has a value for this attribute.
     */
    get missingValuesBanner() {
        return this.container.getByTestId('channelsMissingValuesBanner');
    }

    get notifyChannelAdminsButton() {
        return this.missingValuesBanner.getByRole('button', {name: 'Notify all channel admins'});
    }

    get viewChannelListButton() {
        return this.missingValuesBanner.getByRole('button', {name: 'View channel list'});
    }

    /**
     * Clicks Required. Blocked (MM-70717) while any active channel lacks a
     * value: the toggle stays off and the missing-values banner is what
     * explains why. Callers that expect the block should assert on
     * `missingValuesBanner`/`requiredToggle` themselves rather than calling
     * this — `setRequired(true)` is for the happy path only.
     */
    async setRequired(required: boolean) {
        await setToggle(this.requiredToggle, required);
    }

    /**
     * Opens the "Channels without a value" modal via the banner's secondary
     * button. Present in both create and edit mode.
     */
    async openChannelsWithoutValueModal(): Promise<ChannelsWithoutValueModal> {
        await this.viewChannelListButton.click();
        const modal = new ChannelsWithoutValueModal(this.container.page().getByTestId('channelsWithoutValueModal'));
        await modal.toBeVisible();
        return modal;
    }

    /**
     * Opens the "Notify all channel admins?" confirmation via the banner's
     * primary button. Only present in edit mode (the linked field has no ID
     * yet in create mode, so there is nothing to notify admins about).
     */
    async openNotifyChannelAdminsModal(): Promise<NotifyChannelAdminsModal> {
        await this.notifyChannelAdminsButton.click();
        const modal = new NotifyChannelAdminsModal(this.container.page().getByTestId('notifyChannelAdminsModal'));
        await modal.toBeVisible();
        return modal;
    }

    /**
     * @param policy the menu label, e.g. 'Cannot be changed once set'
     */
    async setChangePolicy(policy: string) {
        await this.changePolicyButton.click();
        await this.container.page().getByRole('menuitemradio', {name: policy, exact: true}).click();
    }

    async setDisplayLocations(locations: ChannelDisplayLocation[]) {
        for (const location of locations) {
            await this.location(location).check();
        }
    }
}

/**
 * The Channels row of the Classification page's "Applies to" card.
 */
export class AppliesToChannels extends ChannelResourceSettings {
    get addResourceButton() {
        return this.container.getByTestId('appliesToAddResource');
    }

    get row() {
        return this.container.getByTestId('channelsResourceRow');
    }

    get summary() {
        return this.container.getByTestId('channelsResourceRowSummary');
    }

    async addResource() {
        await this.addResourceButton.click();
        await expect(this.row).toBeVisible();
    }

    async removeResource() {
        await this.container.getByTestId('channelsResourceRowRemove').click();
    }
}

/**
 * The Channels row of the New attribute page's "Applies to" card, which offers
 * one row per resource type and starts collapsed.
 */
export class AttributeAppliesToChannels extends ChannelResourceSettings {
    get row() {
        return this.container.getByTestId('attributeAppliesToRow-channel');
    }

    get summary() {
        return this.container.getByTestId('attributeAppliesToRow-channel-summary');
    }

    async addResource() {
        await this.container.getByTestId('attributeAppliesToAddResourceButtonHeader').click();
        await this.container.page().getByRole('menuitem', {name: 'Channels', exact: true}).click();
        await expect(this.row).toBeVisible();

        // The settings live behind the row's own disclosure, so everything below
        // needs it open first.
        await this.row.getByTestId('attributeAppliesToRow-channel-toggle').click();
        await expect(this.container.getByTestId('channelsResourceSettings')).toBeVisible();
    }

    /**
     * Opens the disclosure for a Channels resource that already exists (e.g.
     * seeded via the API before navigating here), as opposed to `addResource()`,
     * which drives the "Add resource" menu for a brand-new one. The row always
     * starts collapsed on mount, regardless of whether the resource is new.
     */
    async expand() {
        await this.row.getByTestId('attributeAppliesToRow-channel-toggle').click();
        await expect(this.container.getByTestId('channelsResourceSettings')).toBeVisible();
    }

    async removeResource() {
        await this.row.getByTestId('attributeAppliesToRow-channel-remove').click();
    }
}

/**
 * The Global Attributes pages: the attribute list and the New attribute form.
 */
export default class GlobalAttributes {
    readonly container: Locator;
    readonly appliesToChannels: AppliesToChannels;
    readonly attributeAppliesToChannels: AttributeAppliesToChannels;

    constructor(container: Locator) {
        this.container = container;
        this.appliesToChannels = new AppliesToChannels(container);
        this.attributeAppliesToChannels = new AttributeAppliesToChannels(container);
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

    /**
     * Classification's own attribute page. Its definition is read-only; only the
     * Applies to card can be edited here.
     */
    async gotoClassificationAttribute() {
        await this.container.page().goto(CLASSIFICATION_ATTRIBUTE_PATH);
        await expect(this.container.getByTestId('classificationAttributeName')).toBeVisible();
    }

    get classificationLevels() {
        return this.container.getByTestId('classificationAttributeLevels');
    }

    get classificationMarkingsLink() {
        return this.container.getByTestId('classificationAttributeMarkingsLink');
    }

    /**
     * Saves without waiting for a redirect: the classification page stays put, unlike
     * the New attribute form which returns to the list.
     *
     * Waits for Save to go back to disabled, which is the page's own "nothing left to
     * save" state. Waiting for it to be enabled would pass before the request even
     * left, and the assertions that follow read the field straight from the API.
     */
    async saveInPlace() {
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();
        await expect(this.saveButton).toBeDisabled();
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
