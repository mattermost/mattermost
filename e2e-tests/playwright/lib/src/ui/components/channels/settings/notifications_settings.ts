// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

type NotificationSettingsSection = 'keysWithHighlight' | 'keysWithNotification';

export default class NotificationsSettings {
    readonly container: Locator;

    readonly title;
    public id = '#notificationsSettings';
    readonly expandedSection;
    public expandedSectionId = '.section-max';

    readonly learnMoreText;
    readonly desktopAndMobileEditButton;
    readonly desktopNotificationSoundEditButton;
    readonly emailEditButton;
    readonly keywordsTriggerNotificationsEditButton;
    readonly keywordsGetHighlightedEditButton;

    readonly testNotificationButton;
    readonly troubleshootingDocsButton;

    readonly keysWithHighlightDesc;

    constructor(container: Locator) {
        this.container = container;

        this.title = container.getByRole('heading', {name: 'Notifications', exact: true});
        this.expandedSection = container.locator(this.expandedSectionId);

        this.learnMoreText = container.getByRole('link', {name: 'Learn more about notifications'});
        this.desktopAndMobileEditButton = container.locator('#desktopAndMobileEdit');
        this.desktopNotificationSoundEditButton = container.locator('#desktopNotificationSoundEdit');
        this.emailEditButton = container.locator('#emailEdit');
        this.keywordsTriggerNotificationsEditButton = container.locator('#keywordsAndMentionsEdit');
        this.keywordsGetHighlightedEditButton = container.locator('#keywordsAndHighlightEdit');

        this.testNotificationButton = container.getByRole('button', {name: 'Send a test notification'});
        this.troubleshootingDocsButton = container.getByRole('button', {name: 'Troubleshooting docs 󰏌'});

        this.keysWithHighlightDesc = container.locator('#keywordsAndHighlightDesc');
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
