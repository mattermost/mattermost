// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> Authentication -> AD/LDAP
 */
export default class AdLdap {
    readonly container: Locator;

    readonly usernameAttribute: Locator;
    readonly loginIdAttribute: Locator;
    readonly testConnectionButton: Locator;
    readonly testConnectionSuccess: Locator;
    readonly successIcon: Locator;
    readonly saveButton: Locator;
    readonly errorMessage: Locator;
    readonly usernameAttributeRequiredError: Locator;
    readonly loginIdAttributeRequiredError: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.usernameAttribute = container.getByRole('textbox', {name: 'Username Attribute:'});
        this.loginIdAttribute = container.getByTestId('LdapSettings.LoginIdAttributeinput');
        this.testConnectionButton = container.getByRole('button', {name: 'Test Connection'});
        this.testConnectionSuccess = container.getByText('Test Connection Successful');
        this.successIcon = container.getByTitle('Success Icon');
        this.saveButton = container.getByRole('button', {name: 'Save'});
        this.errorMessage = container.getByTestId('errorMessage');
        this.usernameAttributeRequiredError = container.getByText(
            'AD/LDAP field "Username Attribute" is required.',
        );
        this.loginIdAttributeRequiredError = container.getByText(
            'AD/LDAP field "Login ID Attribute" is required.',
        );
    }

    async toBeVisible() {
        await expect(this.testConnectionButton).toBeVisible();
    }

    async save() {
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();
    }

    async expectSaveComplete() {
        await expect(this.saveButton).toBeDisabled();
    }
}
