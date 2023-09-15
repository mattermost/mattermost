// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

import {NotificationsSettings} from './notification_settings';

export default class AccountSettingsModal {
    readonly container: Locator;

    readonly notificationsSettings: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.notificationsSettings = container.getByRole('tab', {name: 'notifications'});
        
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async openNotificationsTab() {
        await this.notificationsTab.click();
    }

}

export {AccountSettingsModal};
