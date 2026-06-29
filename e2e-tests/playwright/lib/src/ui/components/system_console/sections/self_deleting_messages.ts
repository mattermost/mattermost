// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * System Console -> Site Configuration -> Posts -> Self-Deleting Messages
 */
export default class SelfDeletingMessages extends BaseComponent {
    readonly page: Page;

    readonly enableToggleTrue: Locator;
    readonly enableToggleFalse: Locator;
    readonly durationDropdown: Locator;
    readonly maxTimeToLiveDropdown: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator, page: Page) {
        super(container);
        this.page = page;

        this.enableToggleTrue = this.container.getByTestId('ServiceSettings.EnableBurnOnReadtrue');
        this.enableToggleFalse = this.container.getByTestId('ServiceSettings.EnableBurnOnReadfalse');
        this.durationDropdown = this.container.getByTestId('ServiceSettings.BurnOnReadDurationSecondsdropdown');
        this.maxTimeToLiveDropdown = this.container.getByTestId(
            'ServiceSettings.BurnOnReadMaximumTimeToLiveSecondsdropdown',
        );
        this.saveButton = this.container.getByRole('button', {name: en['save_button.save']});
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
        return this.durationDropdown.inputValue();
    }

    async getMaxTimeToLiveValue(): Promise<string> {
        return this.maxTimeToLiveDropdown.inputValue();
    }

    async clickSaveButton() {
        await this.saveButton.click();
    }

    async isEnabled(): Promise<boolean> {
        return this.enableToggleTrue.isChecked();
    }

    async isDurationDropdownDisabled(): Promise<boolean> {
        return this.durationDropdown.isDisabled();
    }

    async isMaxTimeToLiveDropdownDisabled(): Promise<boolean> {
        return this.maxTimeToLiveDropdown.isDisabled();
    }

    get timerDisplay(): Locator {
        return this.container.getByTestId('burnOnReadTimerChipTime');
    }

    get confirmModal(): Locator {
        return this.container.page().getByRole('dialog');
    }

    get deleteTimerSelector(): Locator {
        return this.durationDropdown;
    }
}
