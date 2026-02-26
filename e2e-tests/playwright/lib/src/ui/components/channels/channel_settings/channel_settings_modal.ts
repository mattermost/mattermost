// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import InfoSettings from './info_settings';
import ConfigurationSettings from './configuration_settings';

export default class ChannelSettingsModal {
    readonly container: Locator;

    readonly closeButton;

    readonly infoTab;
    readonly configurationTab;

    readonly infoSettings;
    readonly configurationSettings;

    constructor(container: Locator) {
        this.container = container;

        this.closeButton = container.getByRole('button', {name: 'Close'});

        this.infoTab = container.getByRole('tab', {name: 'info'});
        this.configurationTab = container.getByRole('tab', {name: 'configuration'});

        this.infoSettings = new InfoSettings(container.locator('.ChannelSettingsModal__infoTab'));
        this.configurationSettings = new ConfigurationSettings(
            container.locator('.ChannelSettingsModal__configurationTab'),
        );
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getContainerId() {
        return this.container.getAttribute('id');
    }

    async close() {
        await this.closeButton.click();

        await expect(this.container).not.toBeVisible();
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
}
