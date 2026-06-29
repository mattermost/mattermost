// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

import {RadioSetting, TextInputSetting, DropdownSetting} from '../../base_components';

/**
 * System Console -> Site Configuration -> Notifications
 */
export default class Notifications extends BaseComponent {
    // Header
    readonly header: Locator;

    // Radio Settings
    readonly showMentionConfirmDialog: RadioSetting;
    readonly enableEmailNotifications: RadioSetting;
    readonly enablePreviewModeBanner: RadioSetting;
    readonly enableEmailBatching: RadioSetting;
    readonly enableNotificationMonitoring: RadioSetting;

    // Dropdown Settings
    readonly emailNotificationContents: DropdownSetting;
    readonly pushNotificationContents: DropdownSetting;

    // Text Input Settings
    readonly notificationDisplayName: TextInputSetting;
    readonly notificationFromAddress: TextInputSetting;
    readonly supportEmailAddress: TextInputSetting;
    readonly notificationReplyToAddress: TextInputSetting;
    readonly notificationFooterMailingAddress: TextInputSetting;

    // Save section
    readonly saveButton: Locator;
    readonly errorMessage: Locator;

    constructor(container: Locator) {
        super(container);

        this.header = container.getByText(en['admin.environment.notifications'], {exact: true});

        this.showMentionConfirmDialog = new RadioSetting(
            container.getByTestId('TeamSettings.EnableConfirmNotificationsToChannel'),
        );
        this.enableEmailNotifications = new RadioSetting(container.getByTestId('EmailSettings.SendEmailNotifications'));
        this.enablePreviewModeBanner = new RadioSetting(container.getByTestId('EmailSettings.EnablePreviewModeBanner'));
        this.enableEmailBatching = new RadioSetting(container.getByTestId('EmailSettings.EnableEmailBatching'));
        this.enableNotificationMonitoring = new RadioSetting(
            container.getByTestId('MetricsSettings.EnableNotificationMetrics'),
        );

        this.emailNotificationContents = new DropdownSetting(
            container.getByTestId('EmailSettings.EmailNotificationContentsType'),
            en['admin.environment.notifications.contents.label'],
        );
        this.pushNotificationContents = new DropdownSetting(
            container.getByTestId('EmailSettings.PushNotificationContents'),
            en['admin.environment.notifications.pushContents.label'],
        );

        this.notificationDisplayName = new TextInputSetting(
            container.getByTestId('EmailSettings.FeedbackName'),
            en['admin.environment.notifications.notificationDisplay.label'],
        );
        this.notificationFromAddress = new TextInputSetting(
            container.getByTestId('EmailSettings.FeedbackEmail'),
            en['admin.environment.notifications.feedbackEmail.label'],
        );
        this.supportEmailAddress = new TextInputSetting(
            container.getByTestId('SupportSettings.SupportEmail'),
            en['admin.environment.notifications.supportEmail.label'],
        );
        this.notificationReplyToAddress = new TextInputSetting(
            container.getByTestId('EmailSettings.ReplyToAddress'),
            en['admin.environment.notifications.replyToAddress.label'],
        );
        this.notificationFooterMailingAddress = new TextInputSetting(
            container.getByTestId('EmailSettings.FeedbackOrganization'),
            en['admin.environment.notifications.feedbackOrganization.label'],
        );

        this.saveButton = container.getByRole('button', {name: en['save_button.save']});
        this.errorMessage = container.getByTestId('errorMessage');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    async save() {
        await this.saveButton.click();
    }

    getSettingFieldError(settingContainer: Locator): Locator {
        return settingContainer.getByTestId('settingFieldError');
    }

    getMultiSelectInput(multiSelectContainer: Locator): Locator {
        return multiSelectContainer.locator('input');
    }
}
