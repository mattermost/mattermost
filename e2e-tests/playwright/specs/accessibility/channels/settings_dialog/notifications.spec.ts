// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {focusVisible} from '../focus_support';

import {selectorOf} from './support';

test(
    'navigate on keyboard tab between interactive elements',
    {tag: ['@accessibility', '@settings', '@notification_settings']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible and focus should be on the modal
        await expect(settingsModal).toBeVisible();
        await expect.poll(() => focusVisible(settingsModal)).toBe(true);

        // # Press Tab and verify focus is on Close button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(settingsModal.closeButton)).toBe(true);

        // # Press Tab to move focus to Notifications tab
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(settingsModal.tabs.tab('notifications'))).toBe(true);

        // # Press Tab to move focus to Learn more link
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.learnMoreLink)).toBe(true);

        // # Press Tab to move focus to Desktop and mobile notifications button
        await page.keyboard.press('Tab');
        await expect
            .poll(() => focusVisible(app.settings.notifications.section('desktopAndMobile').editButton))
            .toBe(true);

        // # Press Tab to move focus to Desktop notification sounds button
        await page.keyboard.press('Tab');
        await expect
            .poll(() => focusVisible(app.settings.notifications.section('desktopNotificationSound').editButton))
            .toBe(true);

        // # Press Tab to move focus to Email notifications button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.notifications.section('email').editButton)).toBe(true);

        // # Press Tab to move focus to Auto-follow threads on channel-wide mentions button
        await page.keyboard.press('Tab');
        await expect
            .poll(() => focusVisible(app.settings.notifications.section('channelMentionAutoFollow').editButton))
            .toBe(true);

        // # Press Tab to move focus to Keywords that trigger notifications button
        await page.keyboard.press('Tab');
        await expect
            .poll(() => focusVisible(app.settings.notifications.section('keywordsAndMentions').editButton))
            .toBe(true);

        // # Press Tab to move focus to Keywords that get highlighted (without notifications) button
        await page.keyboard.press('Tab');
        await expect
            .poll(() => focusVisible(app.settings.notifications.section('keywordsAndHighlight').editButton))
            .toBe(true);

        // # Press Tab to move focus to Send a test notification button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.testNotification.primaryButton)).toBe(true);

        // # Press Tab to move focus to Troubleshooting docs button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.testNotification.tertiaryButton)).toBe(true);
    },
);

test(
    'accessibility scan and aria-snapshot of Notifications settings panel',
    {tag: ['@accessibility', '@settings', '@notification_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, adminClient, team} = await pw.initSetup();
        const clientConfig = await adminClient.getClientConfig();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // * Verify aria snapshot of Notifications settings tab
        await expect(app.settings.panel('notifications')).toMatchAriaSnapshot(`
          - tabpanel "notifications":
            - heading "Notifications" [level=3]
            - link "Learn more about notifications":
              - /url: https://mattermost.com/pl/about-notifications?utm_source=mattermost&utm_medium=in-product&utm_content=user_settings_notifications&uid=${user.id}&sid=${clientConfig.DiagnosticId}&edition=enterprise&server_version=${clientConfig.Version}
            - group:
              - heading "Desktop and mobile notifications Permission required" [level=4]:
                - text: ""
                - img
                - text: ""
              - button "Desktop and mobile notifications Permission required Edit"
              - text: Mentions, direct messages, and group messages
            - group:
              - heading "Desktop notification sounds" [level=4]
              - button "Desktop notification sounds Edit"
              - text: "\\"Bing\\" for messages"
            - group:
              - heading "Email notifications" [level=4]
              - button "Email notifications Edit"
              - text: "On"
            - group:
              - heading "Auto-follow threads on channel-wide mentions" [level=4]
              - button "Auto-follow threads on channel-wide mentions Edit"
              - text: "On"
            - group:
              - heading "Keywords that trigger notifications" [level=4]
              - button "Keywords that trigger notifications Edit"
              - text: "\\"@${user.username}\\", \\"@channel\\", \\"@all\\", \\"@here\\""
            - group:
              - heading "Keywords that get highlighted (without notifications)" [level=4]
              - button "Keywords that get highlighted (without notifications) Edit"
              - text: None
            - heading "Troubleshooting notifications" [level=4]
            - text: Not receiving notifications? Start by sending a test notification to all your devices to check if they’re working as expected. If issues persist, explore ways to solve them with troubleshooting steps.
            - button "Send a test notification"
            - button "Troubleshooting docs"
        `);

        // * Analyze the Notifications settings panel for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include(selectorOf(app.settings.panel('notifications')))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

test(
    'accessibility scan and aria-snapshot of Desktop and mobile notifications section',
    {tag: ['@accessibility', '@settings', '@notification_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, adminClient, team} = await pw.initSetup();

        // # Send push notifications, without which the mobile settings in this section are replaced
        // # by a "not enabled by your system administrator" message
        await adminClient.patchConfig({EmailSettings: {SendPushNotifications: true}});

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Click Edit on Desktop and mobile notifications section
        await app.settings.notifications.section('desktopAndMobile').editButton.click();

        // * Verify aria snapshot of Desktop and mobile notifications section when expanded
        await expect(app.settings.notifications.section('desktopAndMobile')).toBeVisible();
        await expect(app.settings.notifications.section('desktopAndMobile')).toMatchAriaSnapshot({
            name: 'desktop_and_mobile_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.notifications.section('desktopAndMobile').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

test(
    'accessibility scan and aria-snapshot of Desktop notification sounds section',
    {tag: ['@accessibility', '@settings', '@notification_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Click Edit on Desktop notification sounds section
        await app.settings.notifications.section('desktopNotificationSound').editButton.click();

        // * Verify aria snapshot of Desktop notification sounds section when expanded
        await expect(app.settings.notifications.section('desktopNotificationSound')).toBeVisible();
        await expect(app.settings.notifications.section('desktopNotificationSound')).toMatchAriaSnapshot({
            name: 'desktop_notification_sounds_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.notifications.section('desktopNotificationSound').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

test(
    'accessibility scan and aria-snapshot of Email notifications section',
    {tag: ['@accessibility', '@settings', '@notification_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Click Edit on Email notifications section
        await app.settings.notifications.section('email').editButton.click();

        // * Verify aria snapshot of Email notifications section when expanded
        await expect(app.settings.notifications.section('email')).toBeVisible();
        await expect(app.settings.notifications.section('email')).toMatchAriaSnapshot({
            name: 'email_notifications_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.notifications.section('email').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

test(
    'accessibility scan and aria-snapshot of Keywords that trigger notifications section',
    {tag: ['@accessibility', '@settings', '@notification_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Click Edit on Keywords that trigger notifications section
        await app.settings.notifications.section('keywordsAndMentions').editButton.click();

        // * Verify aria snapshot of Keywords that trigger notifications section when expanded
        await expect(app.settings.notifications.section('keywordsAndMentions')).toBeVisible();
        await expect(app.settings.notifications.section('keywordsAndMentions')).toMatchAriaSnapshot(`
      - heading "Keywords that trigger notifications" [level=4]
      - group "Keywords that trigger notifications":
        - checkbox "Your case-sensitive first name \\"${user.first_name}\\""
        - text: Your case-sensitive first name "${user.first_name}"
        - checkbox "Your non case-sensitive username \\"${user.username}\\""
        - text: Your non case-sensitive username "${user.username}"
        - checkbox "Channel-wide mentions \\"@channel\\", \\"@all\\", \\"@here\\"" [checked]
        - text: Channel-wide mentions "@channel", "@all", "@here"
        - checkbox "Other non case-sensitive words, press Tab or use commas to separate keywords:"
        - text: "Other non case-sensitive words, press Tab or use commas to separate keywords:"
        - log
        - combobox "Keywords that trigger notifications"
      - text: Notifications are triggered when someone sends a message that includes your username ("@${user.username}") or any of the options selected above.
      - separator
      - alert
      - button "Save"
      - button "Cancel"
    `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.notifications.section('keywordsAndMentions').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

test(
    'accessibility scan and aria-snapshot of Keywords that get highlighted (without notifications) section',
    {tag: ['@accessibility', '@settings', '@notification_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Click Edit on Keywords that get highlighted (without notifications) section
        await app.settings.notifications.section('keywordsAndHighlight').editButton.click();

        // * Verify aria snapshot of Keywords that get highlighted (without notifications) section when expanded
        await expect(app.settings.notifications.section('keywordsAndHighlight')).toBeVisible();
        await expect(app.settings.notifications.section('keywordsAndHighlight')).toMatchAriaSnapshot({
            name: 'keywords_that_get_highlighted_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.notifications.section('keywordsAndHighlight').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
