// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

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
            container.locator('.form-group').filter({hasText: 'Email Notification Contents:'}),
            'Email Notification Contents:',
        );
        this.pushNotificationContents = new DropdownSetting(
            container.locator('.form-group').filter({hasText: 'Push Notification Contents:'}),
            'Push Notification Contents:',
        );

        this.notificationDisplayName = new TextInputSetting(
            container.locator('.form-group').filter({hasText: 'Notification Display Name:'}),
            'Notification Display Name:',
        );
        this.notificationFromAddress = new TextInputSetting(
            container.locator('.form-group').filter({hasText: 'Notification From Address:'}),
            'Notification From Address:',
        );
        this.supportEmailAddress = new TextInputSetting(
            container.locator('.form-group').filter({hasText: 'Support Email Address:'}),
            'Support Email Address:',
        );
        this.notificationReplyToAddress = new TextInputSetting(
            container.locator('.form-group').filter({hasText: 'Notification Reply-To Address:'}),
            'Notification Reply-To Address:',
        );
        this.notificationFooterMailingAddress = new TextInputSetting(
            container.locator('.form-group').filter({hasText: 'Notification Footer Mailing Address:'}),
            'Notification Footer Mailing Address:',
        );

        this.saveButton = container.getByRole('button', {name: 'Save'});
        this.errorMessage = container.locator('.has-error');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    async save() {
        await this.saveButton.click();
    }
}
