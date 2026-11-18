// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import {openSystemConsoleSection, settle, Api, expect, test, type App, duration, Msg} from '@mattermost/playwright-lib';

/**
 * Patch the Notifications page required fields to known valid values so tests
 * that load the page always start with a saveable form state, regardless of
 * what other parallel tests may have left in the server config.
 */
async function resetNotificationsConfig(adminClient: {
    patchConfig: (config: DeepPartial<AdminConfig>) => Promise<unknown>;
}) {
    await adminClient.patchConfig({
        EmailSettings: {
            FeedbackName: 'Mattermost Notification',
            FeedbackEmail: 'notification@mattertest.com',
        },
        SupportSettings: {
            SupportEmail: 'support@mattertest.com',
        },
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
            {timeout: duration.two_min, intervals: [300, 800, 1500, 3000]},
        )
        .toBe(true);
}

/**
 * Populate the required notification text fields so the form is valid before saving. This does not
 * assert that Save becomes enabled: the admin console only enables it once the form is dirty, and
 * these values may already be what the server holds (e.g. a reused server where this spec ran before).
 * Assert on Save at the call sites that actually changed something.
 */
async function fillRequiredNotificationFields(app: App) {
    await app.admin.setting('EmailSettings.FeedbackName').valueTextbox.fill('Mattermost Notification');
    await expect(app.admin.setting('EmailSettings.FeedbackName').valueTextbox).toHaveValue('Mattermost Notification');
    await app.admin.setting('EmailSettings.FeedbackEmail').valueTextbox.fill('notification@mattertest.com');
    await expect(app.admin.setting('EmailSettings.FeedbackEmail').valueTextbox).toHaveValue(
        'notification@mattertest.com',
    );
    await app.admin.setting('SupportSettings.SupportEmail').valueTextbox.fill('support@mattertest.com');
    await expect(app.admin.setting('SupportSettings.SupportEmail').valueTextbox).toHaveValue('support@mattertest.com');
    await app.admin.setting('EmailSettings.ReplyToAddress').valueTextbox.fill('notification@mattertest.com');
    await expect(app.admin.setting('EmailSettings.ReplyToAddress').valueTextbox).toHaveValue(
        'notification@mattertest.com',
    );
}

/** Opens System Console > Environment > Notifications (direct URL: the sidebar link can be off-screen in CI). */
async function openNotifications(app: App) {
    await openSystemConsoleSection(app, 'environment/notifications');
    await expect(app.admin.screen('notifications')).toBeVisible();
    await expect(app.admin.setting('SupportSettings.SupportEmail').valueTextbox).toBeVisible();
}

test.describe('System Console Notifications', () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify that the Push Notification Contents setting is properly displayed and can be changed to all available options
     */
    test('Push Notification Contents setting displays correctly and saves all options', async ({pw}) => {
        // Multiple reload/save/retry rounds — default 60 s CI timeout is too tight when shards contend on config.
        test.setTimeout(duration.four_min);

        const {adminUser, adminClient} = await pw.getAdminClient();

        if (!adminUser || !adminClient) {
            throw new Error('Failed to get admin user');
        }

        // Ensure required Notifications fields are populated so the Save button
        // starts enabled — prevents state pollution from concurrent initSetup() calls
        // that reset FeedbackName and SupportEmail to '' via updateConfig(defaultConfig).
        await resetNotificationsConfig(adminClient);
        await waitForNotificationsServerPreconditions(adminClient);

        // # Update to default config with required notification fields populated
        await adminClient.patchConfig({
            EmailSettings: {
                FeedbackName: 'Mattermost Notification',
                FeedbackEmail: 'notification@mattertest.com',
                PushNotificationContents: 'full',
            },
            SupportSettings: {
                SupportEmail: 'support@mattertest.com',
            },
        });
        await waitForNotificationsServerPreconditions(adminClient);

        // # Log in as admin
        const {app} = await pw.testBrowser.login(adminUser);

        // # Visit Notifications admin console page, and wait for its settings to load
        await openNotifications(app);

        // Re-apply guard: a concurrent initSetup() may have cleared SupportEmail (a required
        // field) between the initial resetNotificationsConfig call and the page rendering here,
        // leaving the Save button disabled. Re-apply the config and reload so the form
        // renders with all required fields populated.
        await resetNotificationsConfig(adminClient);
        await waitForNotificationsServerPreconditions(adminClient);
        await openNotifications(app);
        await fillRequiredNotificationFields(app);

        // * Verify that setting is visible and matches text content
        const pushNotificationContents = app.admin.setting('EmailSettings.PushNotificationContents');
        await expect(pushNotificationContents.choiceCombobox).toBeVisible();

        // * Verify that the help text is visible and matches text content
        const helpText = pushNotificationContents.helpText.locator;
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

        // Bold markup inside the rendered markdown help text has no generated part and cannot take a test id.
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- bold chunks of rendered markdown cannot take a test id
        const strongElements = helpText.getByRole('strong');
        await expect(strongElements).toHaveText([contents[0], contents[2], contents[4], contents[6], contents[8]]);

        // * Verify that the option/dropdown is visible and has default value
        const dropdown = pushNotificationContents.choiceCombobox;
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
            // Concurrent full-config resets can drop the save, so the whole attempt is retried.
            await expect(async () => {
                await resetNotificationsConfig(adminClient);
                await waitForNotificationsServerPreconditions(adminClient);
                await openNotifications(app);

                const loopDropdown = pushNotificationContents.choiceCombobox;
                await expect(loopDropdown).toBeVisible();
                await loopDropdown.choose(option.label);
                await expect(loopDropdown).toHaveValue(option.value);
                await fillRequiredNotificationFields(app);

                // The dropdown change above dirties the form, so Save must become enabled here.
                await expect(app.admin.saveButton).not.toBeDisabled({timeout: duration.half_min});
                await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

                const {adminClient: pollClient} = await pw.getAdminClient();
                await expect
                    .poll(async () => (await pollClient.getConfig()).EmailSettings?.PushNotificationContents, {
                        timeout: duration.one_min,
                        intervals: [500, 1000, 2000, 3000],
                    })
                    .toBe(option.value);
            }).toPass({timeout: duration.ten_min});
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
        const {app} = await pw.testBrowser.login(adminUser);

        // # Visit Notifications admin console page, and wait for its settings to load
        await openNotifications(app);

        // # Scroll Support Email section into view and verify that it's visible
        const supportEmail = app.admin.setting('SupportSettings.SupportEmail');
        await expect(supportEmail.valueTextbox).toBeVisible();

        // * Verify that the help text is visible and matches text content
        await expect(supportEmail.helpText).toBeVisible();
        await expect(supportEmail.helpText).toHaveMessage(Msg.admin.environment.notifications.supportEmail.help);

        // # Clear and type new email
        const newEmail = 'changed_for_test_support@example.com';
        await supportEmail.valueTextbox.clear();
        await supportEmail.valueTextbox.fill(newEmail);

        // * Verify that set value is visible and matches text
        await expect(supportEmail.valueTextbox).toHaveValue(newEmail);

        // # Wait for Save button to be enabled (React processes fill() events asynchronously)
        await expect(app.admin.saveButton).not.toBeDisabled();

        // # Save setting
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

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
        const {app} = await pw.testBrowser.login(adminUser);

        // # Visit Notifications admin console page, and wait for its settings to load
        await openNotifications(app);

        const tests = [
            {name: 'Support Email Address', field: app.admin.setting('SupportSettings.SupportEmail')},
            {name: 'Notification Display Name', field: app.admin.setting('EmailSettings.FeedbackName')},
            {name: 'Notification From Address', field: app.admin.setting('EmailSettings.FeedbackEmail')},
        ];

        for (const testCase of tests) {
            // # Clear the field
            const input = testCase.field.valueTextbox.locator;
            await expect(input).toBeVisible();
            await input.clear();

            // The field's own error, so other fields' errors on the page don't interfere
            const fieldError = testCase.field.validationErrorText.locator;

            // * Error message is shown and save button is disabled
            await expect(fieldError).toHaveText(`"${testCase.name}" is required`);
            await expect(app.admin.saveButton).toBeDisabled();

            // # Restore the field with a valid value so format-validation errors from
            // this field don't interfere with the next iteration.
            await input.fill('test@example.com');

            // * Ensure error for this field is gone and save button is enabled
            await expect(fieldError).toHaveCount(0);
            await expect(app.admin.saveButton).not.toBeDisabled();
        }
    });
});
