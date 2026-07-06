// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';
import type {Locator} from '@playwright/test';

import type {TextInputSetting} from '@mattermost/playwright-lib';
import {expect, mergeWithOnPremServerConfig, test} from '@mattermost/playwright-lib';

/**
 * Patch the Notifications page required fields to known valid values so tests
 * that load the page always start with a saveable form state, regardless of
 * what other parallel tests may have left in the server config.
 *
 * Uses mergeWithOnPremServerConfig so shallow patchConfig does not drop sibling
 * EmailSettings/SupportSettings keys that the admin UI validates as required.
 */
async function resetNotificationsConfig(adminClient: {
    patchConfig: (config: Partial<AdminConfig>) => Promise<unknown>;
}) {
    const merged = mergeWithOnPremServerConfig({
        EmailSettings: {
            FeedbackName: 'Mattermost Notification',
            FeedbackEmail: 'notification@mattertest.com',
        },
        SupportSettings: {
            SupportEmail: 'support@mattertest.com',
        },
    } as Partial<AdminConfig>);
    await adminClient.patchConfig({
        EmailSettings: merged.EmailSettings,
        SupportSettings: merged.SupportSettings,
    });
}

/** Wait until API reflects required notification fields (guards against concurrent initSetup). */
async function waitForNotificationsServerPreconditions(adminClient: {getConfig: () => Promise<unknown>}) {
    await expect
        .poll(
            async () => {
                const c = (await adminClient.getConfig()) as AdminConfig;
                const support = c.SupportSettings?.SupportEmail?.trim();
                const feedbackEmail = c.EmailSettings?.FeedbackEmail?.trim();
                const feedbackName = c.EmailSettings?.FeedbackName?.trim();
                return Boolean(support && feedbackEmail && feedbackName);
            },
            {timeout: 90_000, intervals: [300, 800, 1500, 3000]},
        )
        .toBe(true);
}

/** Fill required notification text fields until Save enables (UI can lag behind API after reload). */
async function waitForSaveableNotificationsForm(notifications: {
    notificationDisplayName: TextInputSetting;
    notificationFromAddress: TextInputSetting;
    supportEmailAddress: TextInputSetting;
    notificationReplyToAddress: TextInputSetting;
    saveButton: Locator;
}) {
    await notifications.notificationDisplayName.container.scrollIntoViewIfNeeded();
    await notifications.notificationDisplayName.fill('Mattermost Notification');
    await notifications.notificationFromAddress.container.scrollIntoViewIfNeeded();
    await notifications.notificationFromAddress.fill('notification@mattertest.com');
    await notifications.supportEmailAddress.container.scrollIntoViewIfNeeded();
    await notifications.supportEmailAddress.fill('support@mattertest.com');
    await notifications.notificationReplyToAddress.container.scrollIntoViewIfNeeded();
    await notifications.notificationReplyToAddress.fill('notification@mattertest.com');
    await expect(notifications.saveButton).not.toBeDisabled({timeout: 60_000});
}

test.describe('System Console Notifications', () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify that the Push Notification Contents setting is properly displayed and can be changed to all available options
     */
    test('Push Notification Contents setting displays correctly and saves all options', async ({pw}) => {
        // Multiple reload/save/retry rounds — default 60 s CI timeout is too tight when shards contend on config.
        test.setTimeout(240000);

        const {adminUser, adminClient} = await pw.getAdminClient();

        if (!adminUser || !adminClient) {
            throw new Error('Failed to get admin user');
        }

        // Ensure required Notifications fields are populated so the Save button
        // starts enabled — prevents state pollution from concurrent initSetup() calls
        // that reset FeedbackName and SupportEmail to '' via updateConfig(defaultConfig).
        await resetNotificationsConfig(adminClient);
        await waitForNotificationsServerPreconditions(adminClient);

        // # Update to default config (merged so SupportEmail / feedback fields are not cleared)
        const withPush = mergeWithOnPremServerConfig({
            EmailSettings: {
                FeedbackName: 'Mattermost Notification',
                FeedbackEmail: 'notification@mattertest.com',
                PushNotificationContents: 'full',
            },
            SupportSettings: {
                SupportEmail: 'support@mattertest.com',
            },
        } as Partial<AdminConfig>);
        await adminClient.patchConfig({
            EmailSettings: withPush.EmailSettings,
            SupportSettings: withPush.SupportSettings,
        });
        await waitForNotificationsServerPreconditions(adminClient);

        // # Log in as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit Notifications admin console page (direct URL — sidebar link can be off-screen in CI)
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.gotoNotificationsSettings();

        // # Wait for Notifications section to load
        const notifications = systemConsolePage.notifications;
        await notifications.toBeVisible();

        // Re-apply guard: a concurrent initSetup() may have cleared SupportEmail (a required
        // field) between the initial resetNotificationsConfig call and the page rendering here,
        // leaving the Save button disabled. Re-apply the config and reload so the form
        // renders with all required fields populated.
        await resetNotificationsConfig(adminClient);
        await waitForNotificationsServerPreconditions(adminClient);
        await systemConsolePage.page.reload();
        await systemConsolePage.gotoNotificationsSettings();
        await notifications.toBeVisible();
        await waitForSaveableNotificationsForm(notifications);

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
            let saved = false;
            for (let attempt = 0; attempt < 8 && !saved; attempt++) {
                await resetNotificationsConfig(adminClient);
                await waitForNotificationsServerPreconditions(adminClient);
                await systemConsolePage.page.reload();
                await systemConsolePage.gotoNotificationsSettings();
                await notifications.toBeVisible();
                await notifications.pushNotificationContents.container.scrollIntoViewIfNeeded();
                await notifications.pushNotificationContents.toBeVisible();

                const loopDropdown = notifications.pushNotificationContents.dropdown;
                await expect(loopDropdown).toBeVisible();
                await loopDropdown.selectOption({label: option.label});
                await expect(loopDropdown).toHaveValue(option.value);
                await waitForSaveableNotificationsForm(notifications);

                await expect(notifications.saveButton).not.toBeDisabled({timeout: 25000});
                await notifications.save();

                const {adminClient: pollClient} = await pw.getAdminClient();
                try {
                    await expect
                        .poll(
                            async () => {
                                const config = await pollClient.getConfig();
                                return config.EmailSettings?.PushNotificationContents;
                            },
                            {timeout: 45000, intervals: [500, 1000, 2000, 3000]},
                        )
                        .toBe(option.value);
                    saved = true;
                } catch {
                    // Concurrent full-config resets can drop the save — reload and retry.
                }
            }
            if (!saved) {
                throw new Error(`Failed to save PushNotificationContents=${option.value} after retries`);
            }
        }
    });

    /**
     * @objective Verify that the Support Email setting can be changed and saved
     */
    test('MM-T1210 Can change Support Email setting', async ({pw}) => {
        const {adminUser, adminClient} = await pw.getAdminClient();

        if (!adminUser || !adminClient) {
            throw new Error('Failed to get admin user');
        }

        // Ensure required Notifications fields are populated so the Save button
        // starts enabled — prevents state pollution from other parallel tests.
        await resetNotificationsConfig(adminClient);
        await waitForNotificationsServerPreconditions(adminClient);

        // # Log in as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit Notifications admin console page (direct URL — sidebar link can be off-screen in CI)
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.gotoNotificationsSettings();

        // # Wait for Notifications section to load
        const notifications = systemConsolePage.notifications;
        await notifications.toBeVisible();

        // # Scroll Support Email section into view and verify that it's visible
        await notifications.supportEmailAddress.container.scrollIntoViewIfNeeded();
        await notifications.supportEmailAddress.toBeVisible();

        // * Verify that the help text is visible and matches text content
        await expect(notifications.supportEmailAddress.helpText).toBeVisible();
        await expect(notifications.supportEmailAddress.helpText).toHaveText(
            'Email address displayed on support emails.',
        );

        // # Clear and type new email
        const newEmail = 'changed_for_test_support@example.com';
        await notifications.supportEmailAddress.clear();
        await notifications.supportEmailAddress.fill(newEmail);

        // * Verify that set value is visible and matches text
        await expect(notifications.supportEmailAddress.input).toHaveValue(newEmail);

        // # Wait for Save button to be enabled (React processes fill() events asynchronously)
        await expect(notifications.saveButton).not.toBeDisabled();

        // # Save setting
        await notifications.save();

        // * Verify that the config is correctly saved in the server
        await expect
            .poll(async () => {
                const config = await adminClient.getConfig();
                return config.SupportSettings?.SupportEmail;
            })
            .toBe(newEmail);
    });

    /**
     * @objective Verify that the save button is disabled when mandatory fields are empty
     */
    test('MM-41671 cannot save the notifications page if mandatory fields are missing', async ({pw}) => {
        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to get admin user');
        }

        // Ensure all required fields are populated before the test starts so that
        // clearing one field at a time reliably disables the save button, and
        // restoring it reliably re-enables it (no other empty field blocking save).
        await resetNotificationsConfig(adminClient);
        await waitForNotificationsServerPreconditions(adminClient);

        // # Log in as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit Notifications admin console page (direct URL — sidebar link can be off-screen in CI)
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.gotoNotificationsSettings();

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

            // Scope error check to this field's container to avoid strict-mode failure
            // when other fields on the page also have validation errors simultaneously.
            const fieldError = testCase.field.container.locator('.has-error');

            // * Error message is shown and save button is disabled
            await expect(fieldError).toHaveText(`"${testCase.name}" is required`);
            await expect(notifications.saveButton).toBeDisabled();

            // # Restore the field with a valid value so format-validation errors from
            // this field don't interfere with the next iteration.
            await testCase.field.fill('test@example.com');

            // * Ensure error for this field is gone and save button is enabled
            await expect(fieldError).toHaveCount(0);
            await expect(notifications.saveButton).not.toBeDisabled();
        }
    });
});
