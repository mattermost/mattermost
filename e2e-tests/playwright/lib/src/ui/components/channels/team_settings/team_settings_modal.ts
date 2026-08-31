// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import InfoSettings from './info_settings';
import AccessSettings from './access_settings';

export default class TeamSettingsModal {
    readonly container: Locator;

    readonly closeButton;

    readonly infoTab;
    readonly accessTab;
    readonly accessPoliciesTab;

    readonly saveButton;
    readonly undoButton;

    readonly infoSettings;
    readonly accessSettings;

    constructor(container: Locator) {
        this.container = container;

        this.closeButton = container.getByRole('button', {name: 'Close'});

        this.infoTab = container.getByTestId('info-tab-button');
        this.accessTab = container.getByTestId('access-tab-button');
        this.accessPoliciesTab = container.getByTestId('access_policies-tab-button');

        this.saveButton = container.getByTestId('SaveChangesPanel__save-btn');
        this.undoButton = container.getByTestId('SaveChangesPanel__cancel-btn');

        this.infoSettings = new InfoSettings(container);
        this.accessSettings = new AccessSettings(container);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async close() {
        await this.closeButton.click();
    }

    async openInfoTab(): Promise<InfoSettings> {
        await expect(this.infoTab).toBeVisible();
        await this.infoTab.click();

        return this.infoSettings;
    }

    async openAccessTab(): Promise<AccessSettings> {
        await expect(this.accessTab).toBeVisible();
        await this.accessTab.click();

        return this.accessSettings;
    }

    async openAccessPoliciesTab() {
        await expect(this.accessPoliciesTab).toBeVisible();
        await this.accessPoliciesTab.click();
    }

    async save() {
        await expect(this.saveButton).toBeVisible();
        await this.saveButton.click();
    }

    async undo() {
        await expect(this.undoButton).toBeVisible();
        await this.undoButton.click();
    }

    async verifySavedMessage() {
        const savedMessage = this.container.getByText('Settings saved');
        await expect(savedMessage).toBeVisible({timeout: 5000});
    }

    async verifyUnsavedChanges() {
        const warningText = this.container.getByText('You have unsaved changes');
        await expect(warningText).toBeVisible({timeout: 3000});
    }
}
