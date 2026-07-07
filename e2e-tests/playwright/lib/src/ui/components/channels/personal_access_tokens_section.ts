// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class PersonalAccessTokensSection {
    readonly container: Locator;
    readonly tokensEditButton: Locator;
    readonly expirySelect: Locator;
    readonly customExpiryInput: Locator;
    readonly descriptionInput: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.tokensEditButton = container.locator('#tokensEdit');
        this.expirySelect = container.locator('#newTokenExpiry');
        this.customExpiryInput = container.locator('#newTokenExpiryCustom');
        this.descriptionInput = container.locator('#newTokenDescription');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getExpiryOption(text: string | RegExp) {
        return this.expirySelect.locator('option', {hasText: text});
    }

    getTokenRow(description: string) {
        return this.container.getByTestId('personalAccessTokenRow').filter({hasText: description});
    }
}
