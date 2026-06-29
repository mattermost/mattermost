// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * System Console -> Site Configuration -> Localization
 * Covers Languages section and Auto-translation block (or feature discovery when no EA license).
 */
export default class Localization extends BaseComponent {
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
        super(container);

        this.header = container.getByText(en['admin.site.localization'], {exact: true});
        this.featureDiscoveryBlock = container.getByText(en['admin.auto_translation_feature_discovery.title']);
        this.autoTranslationSection = container.getByTestId('autoTranslationSectionHeader');
        this.autoTranslationToggle = container.getByTestId('autoTranslationSectionToggle').locator('button');
        this.providerDropdown = container.getByTestId('Providerdropdown');
        this.mattermostAgentsInactiveNotice = container.getByText(
            en['admin.site.localization.autoTranslationLLMConfigNote'],
        );
        this.mattermostAgentsConfigLink = container.getByRole('link', {
            name: en['admin.site.localization.goToAgentsConfig'],
        });
        this.libreTranslateUrlInput = container.locator('input[id="URL"]');
        this.libreTranslateApiKeyInput = container.locator('input[id="APIKey"]');
        this.targetLanguagesMultiSelect = container.getByTestId('TargetLanguages');
        this.saveButton = container.getByRole('button', {name: en['save_button.save']});
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
