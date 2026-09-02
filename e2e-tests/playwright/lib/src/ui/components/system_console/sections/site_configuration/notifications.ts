// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {RadioSetting, TextInputSetting, DropdownSetting} from '../../base_components';

/**
 * System Console -> Site Configuration -> Notifications
 */
export default class Notifications {
    readonly container: Locator;

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
        this.container = container;

        this.header = container.getByText('Notifications', {exact: true});

        this.showMentionConfirmDialog = new RadioSetting(
            container.getByRole('group', {name: /Show @channel, @all, @here and group mention confirmation dialog/}),
        );
        this.enableEmailNotifications = new RadioSetting(
            container.getByRole('group', {name: /Enable Email Notifications/}),
        );
        this.enablePreviewModeBanner = new RadioSetting(
            container.getByRole('group', {name: /Enable Preview Mode Banner/}),
        );
        this.enableEmailBatching = new RadioSetting(container.getByRole('group', {name: /Enable Email Batching/}));
        this.enableNotificationMonitoring = new RadioSetting(
            container.getByRole('group', {name: /Enable Notification Monitoring/}),
        );

        this.emailNotificationContents = new DropdownSetting(
            container.getByTestId('EmailSettings.EmailNotificationContentsType'),
            'Email Notification Contents:',
            'EmailSettings.EmailNotificationContentsType',
        );
        this.pushNotificationContents = new DropdownSetting(
            container.getByTestId('EmailSettings.PushNotificationContents'),
            'Push Notification Contents:',
            'EmailSettings.PushNotificationContents',
        );

        this.notificationDisplayName = new TextInputSetting(
            container.getByTestId('EmailSettings.FeedbackName'),
            'Notification Display Name:',
            'EmailSettings.FeedbackName',
        );
        this.notificationFromAddress = new TextInputSetting(
            container.getByTestId('EmailSettings.FeedbackEmail'),
            'Notification From Address:',
            'EmailSettings.FeedbackEmail',
        );
        this.supportEmailAddress = new TextInputSetting(
            container.getByTestId('SupportSettings.SupportEmail'),
            'Support Email Address:',
            'SupportSettings.SupportEmail',
        );
        this.notificationReplyToAddress = new TextInputSetting(
            container.getByTestId('EmailSettings.ReplyToAddress'),
            'Notification Reply-To Address:',
            'EmailSettings.ReplyToAddress',
        );
        this.notificationFooterMailingAddress = new TextInputSetting(
            container.getByTestId('EmailSettings.FeedbackOrganization'),
            'Notification Footer Mailing Address:',
            'EmailSettings.FeedbackOrganization',
        );

        this.saveButton = container.getByRole('button', {name: 'Save'});
        this.errorMessage = container.getByTestId('errorMessage');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    async save() {
        await this.saveButton.click();
    }
}
