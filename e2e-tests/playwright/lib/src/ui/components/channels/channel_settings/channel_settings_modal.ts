// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import en from '@/i18n';
import {BaseComponent} from '@/ui/base_component';

import InfoSettings from './info_settings';
import ConfigurationSettings from './configuration_settings';
import AccessRulesSettings from './access_rules_settings';
import PermissionsPolicySettings from './permissions_policy_settings';

export default class ChannelSettingsModal extends BaseComponent {
    readonly closeButton;
    readonly saveButton;

    readonly infoTab;
    readonly configurationTab;
    readonly permissionsPolicyTab;
    readonly accessRulesTab;

    readonly infoSettings;
    readonly configurationSettings;
    readonly permissionsPolicySettings;
    readonly accessRulesSettings;

    constructor(container: Locator) {
        super(container);

        this.closeButton = container.getByRole('button', {name: en['generic.close']});
        this.saveButton = container.getByTestId('SaveChangesPanel__save-btn');

        this.infoTab = container.getByRole('tab', {name: en['channel_settings.tab.info']});
        this.configurationTab = container.getByRole('tab', {name: en['channel_settings.tab.configuration']});

        this.infoSettings = new InfoSettings(container.getByTestId('channelSettingsInfoTab'));
        this.configurationSettings = new ConfigurationSettings(
            container.getByTestId('channelSettingsConfigurationTab'),
        );

        this.permissionsPolicyTab = container.getByTestId('channelSettingsPermissionsPolicyTab');
        this.accessRulesTab = container.getByTestId('channelSettingsAccessRulesTab');

        this.permissionsPolicySettings = new PermissionsPolicySettings(
            container.getByTestId('channelSettingsPermissionsPolicyTab'),
        );
        this.accessRulesSettings = new AccessRulesSettings(container.getByTestId('channelSettingsAccessRulesTab'));
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async getContainerId() {
        return (await this.container.getAttribute('id')) ?? '';
    }

    async close() {
        await this.closeButton.click();

        // The modal uses a two-step close when there are unsaved changes:
        // the first click warns the user (sets hasBeenWarned=true) but keeps the modal open;
        // only the second click actually closes it. Click again if needed.
        try {
            await expect(this.container).not.toBeVisible({timeout: 1000});
        } catch {
            await this.closeButton.click();
            await expect(this.container).not.toBeVisible({timeout: 10000});
        }
    }

    async save() {
        await expect(this.saveButton).toBeVisible();
        await this.saveButton.click();
    }

    get maskedChips(): Locator {
        return this.container.locator('[class*="select__multi-value--masked"]');
    }

    async openInfoTab(): Promise<InfoSettings> {
        await expect(this.infoTab).toBeVisible();
        await this.infoTab.click();

        await this.infoSettings.toBeVisible();

        return this.infoSettings;
    }

    async openConfigurationTab(): Promise<ConfigurationSettings> {
        await expect(this.configurationTab).toBeVisible();
        await this.configurationTab.click();

        await this.configurationSettings.toBeVisible();

        return this.configurationSettings;
    }

    async openAccessRulesTab(): Promise<AccessRulesSettings> {
        await expect(this.accessRulesTab).toBeVisible();
        await this.accessRulesTab.click();

        await this.accessRulesSettings.toBeVisible();

        return this.accessRulesSettings;
    }

    async openPermissionsPolicyTab(): Promise<PermissionsPolicySettings> {
        await expect(this.permissionsPolicyTab).toBeVisible();
        await this.permissionsPolicyTab.click();

        await this.permissionsPolicySettings.toBeVisible();

        return this.permissionsPolicySettings;
    }
}
