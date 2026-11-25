// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {createSurface} from '../../../../surface';

type NotificationSettingsSection = 'keysWithHighlight' | 'keysWithNotification';

/** Webapp `section` prop of each SettingItem (UserSettingsNotificationSections in utils/constants.tsx). */
const sectionKeys: Record<NotificationSettingsSection, string> = {
    keysWithHighlight: 'keywordsAndHighlight',
    keysWithNotification: 'keywordsAndMentions',
};

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
    readonly channelMentionAutoFollowEditButton;
    readonly keywordsTriggerNotificationsEditButton;
    readonly keywordsGetHighlightedEditButton;
    readonly channelWideMentionsCheckbox;

    readonly testNotificationButton;
    readonly troubleshootingDocsButton;

    readonly keysWithHighlightDesc;

    private readonly settingItem;

    constructor(container: Locator) {
        this.container = container;
        this.settingItem = createSurface(container.page()).setting_item(container);

        this.title = container.getByRole('heading', {name: 'Notifications', exact: true});
        this.expandedSection = container.locator(this.expandedSectionId);

        this.learnMoreText = container.getByRole('link', {name: 'Learn more about notifications'});
        this.desktopAndMobileEditButton = this.settingItem.edit('desktopAndMobile').locator;
        this.desktopNotificationSoundEditButton = this.settingItem.edit('desktopNotificationSound').locator;
        this.emailEditButton = this.settingItem.edit('email').locator;
        this.channelMentionAutoFollowEditButton = container.getByRole('button', {
            name: 'Auto-follow threads on channel-wide mentions Edit',
        });
        this.keywordsTriggerNotificationsEditButton = this.settingItem.edit(sectionKeys.keysWithNotification).locator;
        this.keywordsGetHighlightedEditButton = this.settingItem.edit(sectionKeys.keysWithHighlight).locator;
        this.channelWideMentionsCheckbox = container.getByRole('checkbox', {name: 'Channel-wide mentions'});

        this.testNotificationButton = container.getByRole('button', {name: 'Send a test notification'});
        this.troubleshootingDocsButton = container.getByRole('button', {name: 'Troubleshooting docs'});

        this.keysWithHighlightDesc = container.locator('#keywordsAndHighlightDesc');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async expandSection(section: NotificationSettingsSection) {
        // Clicking the Edit button, not the title text, proves the section key exists before the absence check below.
        await this.settingItem.edit(sectionKeys[section]).click();
        await this.verifySectionIsExpanded(section);
    }

    async verifySectionIsExpanded(section: NotificationSettingsSection) {
        await expect(this.container.locator(this.expandedSectionId)).toBeVisible();
        await this.settingItem.edit(sectionKeys[section]).toBeHidden();

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
        await this.settingItem.save.toBeVisible();
        await this.settingItem.save.click();
    }
}
