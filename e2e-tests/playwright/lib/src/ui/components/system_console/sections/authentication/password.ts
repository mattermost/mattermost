// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> Authentication -> Password
 */
export default class PasswordSettings {
    readonly container: Locator;

    readonly minimumLength: Locator;
    readonly maximumLoginAttempts: Locator;
    readonly lowercase: Locator;
    readonly uppercase: Locator;
    readonly number: Locator;
    readonly symbol: Locator;
    readonly saveButton: Locator;
    readonly lengthError: Locator;
    readonly sampleHelpText: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.minimumLength = container.getByPlaceholder('E.g.: "5"');
        this.maximumLoginAttempts = container.getByPlaceholder('E.g.: "10"');
        this.lowercase = container.getByRole('checkbox', {name: 'At least one lowercase letter'});
        this.uppercase = container.getByRole('checkbox', {name: 'At least one uppercase letter'});
        this.number = container.getByRole('checkbox', {name: 'At least one number'});
        this.symbol = container.getByRole('checkbox', {name: 'At least one symbol (e.g. "~!@#$%^&*()")'});
        this.saveButton = container.getByRole('button', {name: 'Save'});
        this.lengthError = container.getByText(
            /Minimum password length must be a whole number greater than or equal to (5|14) and less than or equal to 72\./,
        );
        this.sampleHelpText = container.getByText(/Your password must be \d+-72 characters long/);
    }

    async toBeVisible() {
        await expect(this.minimumLength).toBeVisible();
    }

    async save() {
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();
    }

    async reload() {
        await this.container.page().reload();
        await this.toBeVisible();
    }
}
