// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ProfileModal {
    readonly container: Locator;

    readonly profileSettingsButton;
    readonly securityButton;

    readonly profileSettingsTab;
    readonly securityTab;

    readonly closeButton;
    readonly saveButton;
    readonly cancelButton;
    readonly sectionHeadings;

    constructor(container: Locator) {
        this.container = container;

        this.profileSettingsButton = container.locator('#profileButton');
        this.securityButton = container.locator('#securityButton');

        this.profileSettingsTab = new ProfileSettingsTab(container.getByRole('tabpanel', {name: 'Profile Settings'}));
        this.securityTab = new SecurityTab(container.getByRole('tabpanel', {name: 'Security'}));

        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.saveButton = container.getByRole('button', {name: 'Save'});
        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
        this.sectionHeadings = this.profileSettingsTab.container.getByTestId('section-min').getByRole('heading');
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

    getAttributeSection(label: string) {
        return this.profileSettingsTab.container.getByTestId('section-min').filter({hasText: label});
    }

    getAttributeValue(label: string, value: string) {
        return this.getAttributeSection(label).getByText(value, {exact: true});
    }

    async editAttribute(label: string) {
        await this.getAttributeSection(label)
            .getByRole('button', {name: `${label} Edit`, exact: true})
            .click();
        await expect(this.getAttributeInput(label)).toBeVisible();
    }

    getAttributeInput(label: string) {
        return this.profileSettingsTab.container.getByRole('textbox', {name: label, exact: true});
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
