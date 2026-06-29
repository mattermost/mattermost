// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

/**
 * Personal Access Tokens section within the Security tab of the Profile (Account Settings) modal.
 */
export default class PersonalAccessTokens extends BaseComponent {
    readonly tokensEditButton: Locator;
    readonly expirySelect: Locator;
    readonly customExpiryInput: Locator;
    readonly descriptionInput: Locator;

    constructor(container: Locator) {
        super(container);

        this.tokensEditButton = container.locator('#tokensEdit');
        this.expirySelect = container.locator('#newTokenExpiry');
        this.customExpiryInput = container.locator('#newTokenExpiryCustom');
        this.descriptionInput = container.locator('#newTokenDescription');
    }

    getExpiryOption(text: string | RegExp): Locator {
        return this.expirySelect.locator('option', {hasText: text});
    }

    getTokenRowByName(name: string): Locator {
        return this.container.getByTestId('personalAccessTokenItem').filter({hasText: name});
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
