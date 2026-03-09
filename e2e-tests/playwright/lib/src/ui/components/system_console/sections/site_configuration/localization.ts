// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

/**
 * System Console -> Site Configuration -> Localization
 * Covers Languages section and Auto-translation block (or feature discovery when no EA license).
 */
export default class Localization {
    readonly container: Locator;

    readonly header: Locator;
    readonly featureDiscoveryBlock: Locator;
    readonly autoTranslationSection: Locator;
    readonly autoTranslationToggle: Locator;
    readonly providerDropdown: Locator;
    readonly mattermostAgentsInactiveNotice: Locator;
    readonly mattermostAgentsConfigLink: Locator;
    readonly libreTranslateUrlInput: Locator;
    readonly libreTranslateApiKeyInput: Locator;
    readonly targetLanguagesMultiSelect: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.header = container.getByText('Localization', {exact: true});
        this.featureDiscoveryBlock = container.getByText('Remove language barriers with auto-translation');
        this.autoTranslationSection = container.locator('.autotranslation-section-header');
        this.autoTranslationToggle = container.locator('.autotranslation-section-toggle').locator('button');
        this.providerDropdown = container.getByTestId('Providerdropdown');
        this.mattermostAgentsInactiveNotice = container.getByText('LLMs must first be configured in the Agents plugin.');
        this.mattermostAgentsConfigLink = container.getByRole('link', {name: /Go to Agents plugin config/i});
        this.libreTranslateUrlInput = container.locator('input[id="URL"]');
        this.libreTranslateApiKeyInput = container.locator('input[id="APIKey"]');
        this.targetLanguagesMultiSelect = container.getByTestId('TargetLanguages');
        this.saveButton = container.getByRole('button', {name: 'Save'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    async isToggleOn(): Promise<boolean> {
        const toggle = this.autoTranslationToggle;
        await toggle.waitFor({state: 'visible'});
        const ariaChecked = await toggle.getAttribute('aria-checked');
        return ariaChecked === 'true';
    }

    async turnOnAutoTranslation() {
        const on = await this.isToggleOn();
        if (!on) {
            await this.autoTranslationToggle.click();
        }
    }

    async selectTranslationProvider(label: string) {
        await this.providerDropdown.selectOption({label});
    }

    async save() {
        await this.saveButton.click();
    }
}
