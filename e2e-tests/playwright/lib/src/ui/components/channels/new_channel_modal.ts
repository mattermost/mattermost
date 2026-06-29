// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class NewChannelModal extends BaseComponent {
    readonly displayNameInput: Locator;
    readonly urlSection: Locator;
    readonly purposeInput: Locator;
    readonly publicTypeButton: Locator;
    readonly privateTypeButton: Locator;
    readonly createButton: Locator;
    readonly cancelButton: Locator;
    readonly classificationBannerTextInput: Locator;
    readonly classificationToggle: Locator;
    readonly classificationLevelDropdown: Locator;
    readonly managedCategoryInput: Locator;

    constructor(container: Locator) {
        super(container);

        this.displayNameInput = container.locator('[name="new-channel-modal-name"]');
        this.urlSection = container.getByTestId('channelURLSection');
        this.purposeInput = container.locator('#new-channel-modal-purpose');
        this.publicTypeButton = container.locator('#public-private-selector-button-O');
        this.privateTypeButton = container.locator('#public-private-selector-button-P');
        this.createButton = container.getByRole('button', {name: en['channel_modal.createNew']});
        this.cancelButton = container.getByRole('button', {name: en['channel_modal.cancel']});
        this.classificationBannerTextInput = container.locator('#channel_classification_banner_text');
        this.classificationToggle = container.getByTestId('channelClassificationToggle-button');
        this.classificationLevelDropdown = container.getByTestId('channelClassificationLevel');
        this.managedCategoryInput = container.getByRole('combobox');
    }

    get classificationDropdownMenu(): Locator {
        return this.container.page().locator('[class*="DropDown__menu"]').last();
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
