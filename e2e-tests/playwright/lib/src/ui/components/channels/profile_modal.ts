// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class ProfileModal {
    readonly container: Locator;

    readonly profileSettingsButton;
    readonly securityButton;

    readonly profileSettingsTab;
    readonly securityTab;

    readonly closeButton;
    readonly saveButton;
    readonly cancelButton;

    readonly errorText;

    constructor(container: Locator) {
        this.container = container;

        this.profileSettingsButton = container.locator('#profileButton');
        this.securityButton = container.locator('#securityButton');

        this.profileSettingsTab = new ProfileSettingsTab(container.getByRole('tabpanel', {name: 'Profile Settings'}));
        this.securityTab = new SecurityTab(container.getByRole('tabpanel', {name: 'Security'}));

        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.saveButton = container.locator('button:has-text("Save")');
        this.cancelButton = container.locator('button:has-text("Cancel")');

        this.errorText = container.locator('#clientError');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async openProfileSettingsTab() {
        await expect(this.profileSettingsButton).toBeVisible();
        await this.profileSettingsButton.click();

        await this.profileSettingsTab.toBeVisible();

        return this.profileSettingsTab;
    }

    async openSecurityTab() {
        await expect(this.securityButton).toBeVisible();
        await this.securityButton.click();

        await this.securityTab.toBeVisible();

        return this.securityTab;
    }

    async closeModal() {
        await this.closeButton.click();
        await expect(this.container).not.toBeVisible();
    }
}

class ProfileSettingsTab {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

class SecurityTab {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
