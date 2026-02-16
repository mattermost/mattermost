// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminConfig} from '@mattermost/types/config';

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the Push Notification Contents setting is properly displayed and can be changed to all available options
 */
test('Push Notification Contents setting displays correctly and saves all options', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Update to default config
    await adminClient.patchConfig({
        EmailSettings: {
            PushNotificationContents: 'full',
            FeedbackName: 'Mattermost Test Team',
            FeedbackEmail: 'feedback@mattertest.com',
        },
        SupportSettings: {
            SupportEmail: 'support@mattertest.com',
        },
    } as Partial<AdminConfig>);

    if (!adminUser) {
        throw new Error('Failed to get admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit Notifications admin console page
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();
    await systemConsolePage.sidebar.notifications.click();

    // # Wait for Notifications section to load
    const notifications = systemConsolePage.notifications;
    await notifications.toBeVisible();

    // * Verify that setting is visible and matches text content
    await notifications.pushNotificationContents.container.scrollIntoViewIfNeeded();
    await notifications.pushNotificationContents.toBeVisible();

    // * Verify that the help text is visible and matches text content
    const helpText = notifications.pushNotificationContents.helpText;
    await expect(helpText).toBeVisible();

    const contents = [
        'Generic description with only sender name',
        ' - Includes only the name of the person who sent the message in push notifications, with no information about channel name or message contents. ',
        'Generic description with sender and channel names',
        ' - Includes the name of the person who sent the message and the channel it was sent in, but not the message contents. ',
        'Full message content sent in the notification payload',
        " - Includes the message contents in the push notification payload that is relayed through Apple's Push Notification Service (APNS) or Google's Firebase Cloud Messaging (FCM). It is ",
        'highly recommended',
        ' this option only be used with an "https" protocol to encrypt the connection and protect confidential information sent in messages.',
        'Full message content fetched from the server on receipt',
        ' - The notification payload relayed through APNS or FCM contains no message content, instead it contains a unique message ID used to fetch message content from the server when a push notification is received by a device. If the server cannot be reached, a generic notification will be displayed.',
    ];
    await expect(helpText).toHaveText(contents.join(''));

    const strongElements = helpText.locator('strong');
    await expect(strongElements.nth(0)).toHaveText(contents[0]);
    await expect(strongElements.nth(1)).toHaveText(contents[2]);
    await expect(strongElements.nth(2)).toHaveText(contents[4]);
    await expect(strongElements.nth(3)).toHaveText(contents[6]);
    await expect(strongElements.nth(4)).toHaveText(contents[8]);

    // * Verify that the option/dropdown is visible and has default value
    const dropdown = notifications.pushNotificationContents.dropdown;
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toHaveValue('full');

    const options = [
        {label: 'Generic description with only sender name', value: 'generic_no_channel'},
        {label: 'Generic description with sender and channel names', value: 'generic'},
        {label: 'Full message content sent in the notification payload', value: 'full'},
        {label: 'Full message content fetched from the server on receipt', value: 'id_loaded'},
    ];

    // # Select each value and save
    // * Verify that the config is correctly saved in the server
    for (const option of options) {
        await dropdown.selectOption({label: option.label});
        await expect(dropdown).toHaveValue(option.value);

        await notifications.save();

        // * Verify config is saved
        const {adminClient} = await pw.getAdminClient();
        const config = await adminClient.getConfig();
        expect(config.EmailSettings?.PushNotificationContents).toBe(option.value);
    }
});

/**
 * @objective Verify that the Support Email setting can be changed and saved
 */
test('MM-T1210 Can change Support Email setting', async ({pw}) => {
    const {adminUser} = await pw.getAdminClient();

    if (!adminUser) {
        throw new Error('Failed to get admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit Notifications admin console page
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();
    await systemConsolePage.sidebar.notifications.click();

    // # Wait for Notifications section to load
    const notifications = systemConsolePage.notifications;
    await notifications.toBeVisible();

    // # Scroll Support Email section into view and verify that it's visible
    await notifications.supportEmailAddress.container.scrollIntoViewIfNeeded();
    await notifications.supportEmailAddress.toBeVisible();

    // * Verify that the help text is visible and matches text content
    await expect(notifications.supportEmailAddress.helpText).toBeVisible();
    await expect(notifications.supportEmailAddress.helpText).toHaveText('Email address displayed on support emails.');

    // # Clear and type new email
    const newEmail = 'changed_for_test_support@example.com';
    await notifications.supportEmailAddress.clear();
    await notifications.supportEmailAddress.fill(newEmail);

    // * Verify that set value is visible and matches text
    await expect(notifications.supportEmailAddress.input).toHaveValue(newEmail);

    // # Save setting
    await notifications.save();

    // * Verify that the config is correctly saved in the server
    const {adminClient} = await pw.getAdminClient();
    const config = await adminClient.getConfig();
    expect(config.SupportSettings?.SupportEmail).toBe(newEmail);
});

/**
 * @objective Verify that the save button is disabled when mandatory fields are empty
 */
test('MM-41671 cannot save the notifications page if mandatory fields are missing', async ({pw}) => {
    const {adminUser} = await pw.getAdminClient();
    if (!adminUser) {
        throw new Error('Failed to get admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit Notifications admin console page
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();
    await systemConsolePage.sidebar.notifications.click();

    // # Wait for Notifications section to load
    const notifications = systemConsolePage.notifications;
    await notifications.toBeVisible();

    const tests = [
        {name: 'Support Email Address', field: notifications.supportEmailAddress},
        {name: 'Notification Display Name', field: notifications.notificationDisplayName},
        {name: 'Notification From Address', field: notifications.notificationFromAddress},
    ];

    for (const testCase of tests) {
        // # Clear the field
        await testCase.field.toBeVisible();
        await testCase.field.clear();

        // * Error message is shown and save button is disabled
        await expect(notifications.errorMessage).toHaveText(`"${testCase.name}" is required`);
        await expect(notifications.saveButton).toBeDisabled();

        // # Insert something in the field
        await testCase.field.fill('anything');

        // * Ensure no error message is shown and the save button is not disabled
        await expect(notifications.errorMessage).toHaveCount(0);
        await expect(notifications.saveButton).not.toBeDisabled();
    }
});
