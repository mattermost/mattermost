// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

/**
 * System Console -> Site Configuration -> Notifications
 */
export default class SystemConsoleNotifications {
    readonly container: Locator;

    // header
    readonly header: Locator;

    // Notification Display Name
    readonly notificationDisplayName: Locator;
    readonly notificationDisplayNameInput: Locator;
    readonly notificationDisplayNameHelpText: Locator;

    // Notification From Address
    readonly notificationFromAddress: Locator;
    readonly notificationFromAddressInput: Locator;
    readonly notificationFromAddressHelpText: Locator;

    // Support Email Address
    readonly supportEmailAddress: Locator;
    readonly supportEmailAddressInput: Locator;
    readonly supportEmailHelpText: Locator;

    // Push Notification Contents
    readonly pushNotificationContents: Locator;
    readonly pushNotificationContentsDropdown: Locator;
    readonly pushNotificationContentsHelpText: Locator;

    // Save button
    readonly saveButton: Locator;
    readonly errorMessage: Locator;

    constructor(container: Locator) {
        this.container = container;

        // header
        this.header = this.container.locator('.admin-console__header').getByText('Notifications');

        // Notification Display Name
        this.notificationDisplayName = this.container.getByTestId('EmailSettings.FeedbackNameinput');
        this.notificationDisplayNameInput = this.container.getByTestId('EmailSettings.FeedbackNameinput');
        this.notificationDisplayNameHelpText = this.container.getByTestId('EmailSettings.FeedbackNamehelp-text');

        // Notification From Address
        this.notificationFromAddress = this.container.getByLabel('Notification From Address:');
        this.notificationFromAddressInput = this.container.getByTestId('EmailSettings.FeedbackEmailinput');
        this.notificationFromAddressHelpText = this.container.getByTestId('EmailSettings.FeedbackEmailhelp-text');

        // Support Email Address
        this.supportEmailAddress = this.container.getByLabel('Support Email Address:');
        this.supportEmailAddressInput = this.container.getByTestId('SupportSettings.SupportEmailinput');
        this.supportEmailHelpText = this.container.getByTestId('SupportSettings.SupportEmailhelp-text');

        // Push Notification Contents
        this.pushNotificationContents = this.container.getByTestId('EmailSettings.PushNotificationContents');
        this.pushNotificationContentsDropdown = this.container.getByTestId(
            'EmailSettings.PushNotificationContentsdropdown',
        );
        this.pushNotificationContentsHelpText = this.container.getByTestId(
            'EmailSettings.PushNotificationContentshelp-text',
        );

        // Save button and error message
        this.saveButton = this.container.getByTestId('saveSetting');
        this.errorMessage = this.container.locator('.has-error');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
