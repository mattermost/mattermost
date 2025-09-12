// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import DisplaySettings from './display_settings';
import NotificationsSettings from './notifications_settings';

export default class SettingsModal {
    readonly container: Locator;

    readonly closeButton;

    readonly notificationsTab;
    readonly displayTab;
    readonly sidebarTab;
    readonly advancedTab;

    readonly notificationsSettings;
    readonly displaySettings;

    constructor(container: Locator) {
        this.container = container;

        this.closeButton = container.getByRole('button', {name: 'Close'});

        this.notificationsTab = container.getByRole('tab', {name: 'notifications'});
        this.displayTab = container.getByRole('tab', {name: 'display'});
        this.sidebarTab = container.getByRole('tab', {name: 'sidebar'});
        this.advancedTab = container.getByRole('tab', {name: 'advanced'});

        this.notificationsSettings = new NotificationsSettings(
            container.getByRole('tabpanel', {name: 'notifications'}),
        );
        this.displaySettings = new DisplaySettings(container.getByRole('tabpanel', {name: 'display'}));
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getContainerId() {
        return this.container.getAttribute('id');
    }

    async openNotificationsTab() {
        await expect(this.notificationsTab).toBeVisible();
        await this.notificationsTab.click();

        await this.notificationsSettings.toBeVisible();

        return this.notificationsSettings;
    }

    async openDisplayTab() {
        await expect(this.displayTab).toBeVisible();
        await this.displayTab.click();

        await this.displaySettings.toBeVisible();

        return this.displaySettings;
    }

    async close() {
        await this.container.getByLabel('Close').click();

        await expect(this.container).not.toBeVisible();
    }
}
