// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator, Page} from '@playwright/test';

/**
 * System Console -> Site Configuration -> Posts -> Self-Deleting Messages
 */
export default class SelfDeletingMessages {
    readonly page: Page;
    readonly container: Locator;

    readonly enableToggleTrue: Locator;
    readonly enableToggleFalse: Locator;
    readonly durationDropdown: Locator;
    readonly maxTimeToLiveDropdown: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator, page: Page) {
        this.container = container;
        this.page = page;

        this.enableToggleTrue = this.container.getByTestId('ServiceSettings.EnableBurnOnReadtrue');
        this.enableToggleFalse = this.container.getByTestId('ServiceSettings.EnableBurnOnReadfalse');
        this.durationDropdown = this.container.getByTestId('ServiceSettings.BurnOnReadDurationSecondsdropdown');
        this.maxTimeToLiveDropdown = this.container.getByTestId('ServiceSettings.BurnOnReadMaximumTimeToLiveSecondsdropdown');
        this.saveButton = this.container.getByRole('button', {name: 'Save'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async clickEnableToggleTrue() {
        await this.enableToggleTrue.click();
    }

    async clickEnableToggleFalse() {
        await this.enableToggleFalse.click();
    }

    async selectDuration(value: string) {
        await this.durationDropdown.selectOption(value);
    }

    async selectMaxTimeToLive(value: string) {
        await this.maxTimeToLiveDropdown.selectOption(value);
    }

    async getDurationValue(): Promise<string> {
        return await this.durationDropdown.inputValue();
    }

    async getMaxTimeToLiveValue(): Promise<string> {
        return await this.maxTimeToLiveDropdown.inputValue();
    }

    async clickSaveButton() {
        await this.saveButton.click();
    }

    async isEnabled(): Promise<boolean> {
        return await this.enableToggleTrue.isChecked();
    }

    async isDurationDropdownDisabled(): Promise<boolean> {
        return await this.durationDropdown.isDisabled();
    }

    async isMaxTimeToLiveDropdownDisabled(): Promise<boolean> {
        return await this.maxTimeToLiveDropdown.isDisabled();
    }
}

