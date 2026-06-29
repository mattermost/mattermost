// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';
import {stripHtml} from '@/util';

type NotificationSettingsSection = 'keysWithHighlight' | 'keysWithNotification';

export default class NotificationsSettings extends BaseComponent {
    readonly title;
    public id = '#notificationsSettings';
    readonly expandedSection;
    public expandedSectionId = 'section-max';

    readonly learnMoreText;
    readonly desktopAndMobileEditButton;
    readonly desktopNotificationSoundEditButton;
    readonly emailEditButton;
    readonly channelMentionAutoFollowEditButton;
    readonly keywordsTriggerNotificationsEditButton;
    readonly keywordsGetHighlightedEditButton;

    readonly testNotificationButton;
    readonly troubleshootingDocsButton;

    readonly keysWithHighlightDesc;

    constructor(container: Locator) {
        super(container);

        this.title = container.getByRole('heading', {name: en['user.settings.modal.notifications'], exact: true});
        this.expandedSection = container.getByTestId(this.expandedSectionId);

        this.learnMoreText = container.getByRole('link', {
            name: stripHtml(en['user.settings.notifications.learnMore']),
        });
        this.desktopAndMobileEditButton = container.locator('#desktopAndMobileEdit');
        this.desktopNotificationSoundEditButton = container.locator('#desktopNotificationSoundEdit');
        this.emailEditButton = container.locator('#emailEdit');
        this.channelMentionAutoFollowEditButton = container.getByRole('button', {
            name: en['user.settings.notifications.channelMentionAutoFollow.title'],
        });
        this.keywordsTriggerNotificationsEditButton = container.locator('#keywordsAndMentionsEdit');
        this.keywordsGetHighlightedEditButton = container.locator('#keywordsAndHighlightEdit');

        this.testNotificationButton = container.getByRole('button', {
            name: en['user_settings.notifications.test_notification.send_button.send'],
        });
        this.troubleshootingDocsButton = container.getByRole('button', {
            name: en['user_settings.notifications.test_notification.go_to_docs'],
        });

        this.keysWithHighlightDesc = container.locator('#keywordsAndHighlightDesc');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async expandSection(section: NotificationSettingsSection) {
        if (section === 'keysWithHighlight') {
            await this.container.getByText(en['user.settings.notifications.keywordsWithHighlight.title']).click();
            await this.verifySectionIsExpanded('keysWithHighlight');
        }
    }

    async verifySectionIsExpanded(section: NotificationSettingsSection) {
        await expect(this.container.locator(`#${section}Edit`)).not.toBeVisible();

        if (section === 'keysWithHighlight') {
            await expect(
                this.container.getByText(en['user.settings.notifications.keywordsWithHighlight.inputTitle']),
            ).toBeVisible();
            await expect(
                this.container.getByText(en['user.settings.notifications.keywordsWithHighlight.extraInfo']),
            ).toBeVisible();
        }
    }

    async getKeywordsInput() {
        await expect(this.container.locator('input')).toBeVisible();
        return this.container.locator('input');
    }

    async save() {
        await expect(this.container.getByText(en['save_button.save'])).toBeVisible();
        await this.container.getByText(en['save_button.save']).click();
    }
}
