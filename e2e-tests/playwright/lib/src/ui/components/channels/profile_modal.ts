// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

import PersonalAccessTokensSection from './settings/personal_access_tokens_section';

/**
 * Exposes locators for Custom Profile Attributes within the user settings panel.
 */
export class CustomProfileAttributes extends BaseComponent {
    getAttributeEditButton(fieldId: string): Locator {
        return this.container.locator(`#customAttribute_${fieldId}Edit`);
    }

    getAttributeInput(fieldId: string): Locator {
        return this.container.locator(`#customAttribute_${fieldId}`);
    }

    getAttributeSelect(fieldId: string): Locator {
        return this.container.locator(`#customProfileAttribute_${fieldId}`);
    }

    getAttributeSelectContainer(fieldId: string): Locator {
        // eslint-disable-next-line no-restricted-syntax
        return this.getAttributeSelect(fieldId).locator('..');
    }

    get saveButton(): Locator {
        return this.container.getByRole('button', {name: en['generic_btn.save']});
    }

    getAttributeLabel(attributeName: string): Locator {
        return this.container.getByText(attributeName, {exact: false});
    }

    getAttributeError(fieldId: string): Locator {
        return this.container.getByTestId(`error_customAttribute_${fieldId}`);
    }

    getSectionByName(name: string): Locator {
        return this.container.getByTestId('section-min').filter({hasText: name});
    }

    getSectionByDisplayName(name: string): Locator {
        return this.container.getByTestId('section-min').filter({hasText: name});
    }
}

export default class ProfileModal extends BaseComponent {
    readonly profileSettingsButton;
    readonly securityButton;

    readonly profileSettingsTab;
    readonly securityTab;

    readonly closeButton;
    readonly saveButton;
    readonly cancelButton;

    constructor(container: Locator) {
        super(container);

        this.profileSettingsButton = container.locator('#profileButton');
        this.securityButton = container.locator('#securityButton');

        this.profileSettingsTab = new ProfileSettingsTab(
            container.getByRole('tabpanel', {name: en['user.settings.modal.profile']}),
        );
        this.securityTab = new SecurityTab(container.getByRole('tabpanel', {name: en['user.settings.modal.security']}));

        this.closeButton = container.getByRole('button', {name: en['generic.close']});
        this.saveButton = container.getByRole('button', {name: en['generic_btn.save']});
        this.cancelButton = container.getByRole('button', {name: en['generic_btn.cancel']});
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

class ProfileSettingsTab extends BaseComponent {
    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

class SecurityTab extends BaseComponent {
    readonly personalAccessTokensSection: PersonalAccessTokensSection;

    constructor(container: Locator) {
        super(container);

        this.personalAccessTokensSection = new PersonalAccessTokensSection(container);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
