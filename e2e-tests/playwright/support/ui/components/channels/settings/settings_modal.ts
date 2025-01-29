// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

import {NotificationsSettings} from './notification_settings';

export default class SettingsModal {
    readonly container: Locator;

    readonly notificationsSettingsTab;
    readonly notificationsSettings;

    constructor(container: Locator) {
        this.container = container;

        this.notificationsSettingsTab = container.locator('#notificationsButton');
        this.notificationsSettings = new NotificationsSettings(container.locator('#notificationsSettings'));
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async openNotificationsTab() {
        await expect(this.notificationsSettingsTab).toBeVisible();
        await this.notificationsSettingsTab.click();

        await this.notificationsSettings.toBeVisible();
    }

    async closeModal() {
        await this.container.getByLabel('Close').click();

        await expect(this.container).not.toBeVisible();
    }
}

export {SettingsModal};
