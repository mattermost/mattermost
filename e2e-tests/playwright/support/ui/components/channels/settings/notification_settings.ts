// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

type NotificationSettingsSection = 'keysWithHighlight' | 'keysWithNotification';

export default class NotificationsSettings {
    readonly container: Locator;
    readonly keysWithHighlightDesc: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.keysWithHighlightDesc = container.locator('#keysWithHighlightDesc');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async expandSection(section: NotificationSettingsSection) {
        if (section === 'keysWithHighlight') {
            await this.container.getByText('Keywords That Get Highlighted (without notifications)').click();
            await this.verifySectionIsExpanded('keysWithHighlight');
        }
    }

    async verifySectionIsExpanded(section: NotificationSettingsSection) {
        await expect(this.container.locator(`#${section}Edit`)).not.toBeVisible();

        if (section === 'keysWithHighlight') {
            await expect(
                this.container.getByText(
                    'Enter non case-sensitive keywords, press Tab or use commas to separate them:',
                ),
            ).toBeVisible();
            await expect(
                this.container.getByText(
                    'These keywords will be shown to you with a highlight when anyone sends a message that includes them.',
                ),
            ).toBeVisible();
        }
    }

    async getKeywordsInput() {
        await expect(this.container.locator('input')).toBeVisible();
        return this.container.locator('input');
    }

    async save() {
        await expect(this.container.getByText('Save')).toBeVisible();
        await this.container.getByText('Save').click();
    }
}

export {NotificationsSettings};
