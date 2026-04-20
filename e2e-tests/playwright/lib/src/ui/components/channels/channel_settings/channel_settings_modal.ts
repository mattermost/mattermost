// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import InfoSettings from './info_settings';
import ConfigurationSettings from './configuration_settings';

export default class ChannelSettingsModal {
    readonly container: Locator;

    readonly closeButton;
    readonly saveButton;

    readonly infoTab;
    readonly configurationTab;

    readonly infoSettings;
    readonly configurationSettings;

    constructor(container: Locator) {
        this.container = container;

        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.saveButton = container.getByTestId('SaveChangesPanel__save-btn');

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
