// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import DisplaySettings from './display_settings';
import NotificationsSettings from './notification_settings';

export default class SettingsModal {
    readonly container: Locator;

    readonly notificationsSettingsTab;
    readonly notificationsSettings;

    readonly displaySettingsTab;
    readonly displaySettings;

    constructor(container: Locator) {
        this.container = container;

        this.notificationsSettingsTab = container.locator('#notificationsButton');
        this.notificationsSettings = new NotificationsSettings(container.locator('#notificationsSettings'));

        this.displaySettingsTab = container.locator('#displayButton');
        this.displaySettings = new DisplaySettings(container.locator('#displaySettings'));
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async openNotificationsTab() {
        await expect(this.notificationsSettingsTab).toBeVisible();
        await this.notificationsSettingsTab.click();

        await this.notificationsSettings.toBeVisible();

        return this.notificationsSettings;
    }

    async openDisplayTab() {
        await expect(this.displaySettingsTab).toBeVisible();
        await this.displaySettingsTab.click();

        await this.displaySettings.toBeVisible();

        return this.displaySettings;
    }

    async closeModal() {
        await this.container.getByLabel('Close').click();

        await expect(this.container).not.toBeVisible();
    }
}
