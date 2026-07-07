// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import ManagedCategorySelector from './managed_category_selector';

export default class NewChannelModal {
    readonly container: Locator;

    readonly displayNameInput: Locator;
    readonly urlSection: Locator;
    readonly purposeInput: Locator;
    readonly publicTypeButton: Locator;
    readonly privateTypeButton: Locator;
    readonly createButton: Locator;
    readonly cancelButton: Locator;
    readonly managedCategorySelector: ManagedCategorySelector;

    constructor(container: Locator) {
        this.container = container;

        this.displayNameInput = container.getByLabel('Channel name');
        this.urlSection = container.getByTestId('urlInputLabel');
        this.purposeInput = container.locator('#new-channel-modal-purpose');
        this.publicTypeButton = container.locator('#public-private-selector-button-O');
        this.privateTypeButton = container.locator('#public-private-selector-button-P');
        this.createButton = container.getByRole('button', {name: 'Create channel'});
        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
        this.managedCategorySelector = new ManagedCategorySelector(container);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async fillDisplayName(name: string) {
        await this.displayNameInput.fill(name);
        await this.displayNameInput.press('Tab');
    }

    async create() {
        await this.createButton.click();
    }

    async cancel() {
        await this.cancelButton.click();
    }
}
