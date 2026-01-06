// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test(
    'navigate on keyboard tab between interactive elements',
    {tag: ['@accessibility', '@settings', '@notification_settings']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const globalHeader = channelsPage.globalHeader;
        const settingsModal = channelsPage.settingsModal;
        const notificationsSettings = settingsModal.notificationsSettings;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible and focus should be on the modal
        await expect(settingsModal.container).toBeVisible();
        await pw.toBeFocusedWithFocusVisible(settingsModal.container);

        // # Press Tab and verify focus is on Close button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(settingsModal.closeButton);

        // # Press Tab to move focus to Notifications tab
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(settingsModal.notificationsTab);

        // # Press Tab to move focus to Learn more link
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationsSettings.learnMoreText);

        // # Press Tab to move focus to Desktop and mobile notifications button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationsSettings.desktopAndMobileEditButton);

        // # Press Tab to move focus to Desktop notification sounds button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationsSettings.desktopNotificationSoundEditButton);

        // # Press Tab to move focus to Email notifications button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationsSettings.emailEditButton);

        // # Press Tab to move focus to Keywords that trigger notifications button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationsSettings.keywordsTriggerNotificationsEditButton);

        // # Press Tab to move focus to Keywords that get highlighted (without notifications) button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationsSettings.keywordsGetHighlightedEditButton);

        // # Press Tab to move focus to Send a test notification button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationsSettings.testNotificationButton);

        // # Press Tab to move focus to Troubleshooting docs button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationsSettings.troubleshootingDocsButton);
    },
);

test(
    'accessibility scan and aria-snapshot of Notifications settings panel',
    {tag: ['@accessibility', '@settings', '@notification_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, adminClient} = await pw.initSetup();
        const clientConfig = await adminClient.getClientConfig();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const globalHeader = channelsPage.globalHeader;
        const settingsModal = channelsPage.settingsModal;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal.container).toBeVisible();

        // * Verify aria snapshot of Notifications settings tab
        await expect(settingsModal.notificationsSettings.container).toMatchAriaSnapshot(`
          - tabpanel "notifications":
            - heading "Notifications" [level=3]
            - link "Learn more about notifications":
              - /url: https://mattermost.com/pl/about-notifications?utm_source=mattermost&utm_medium=in-product&utm_content=user_settings_notifications&uid=${user.id}&sid=${clientConfig.DiagnosticId}&edition=enterprise&server_version=${clientConfig.Version}
              - img
            - heading "Desktop and mobile notifications Permission required" [level=4]:
              - img
            - button "Desktop and mobile notifications Permission required Edit"
            - text: Mentions, direct messages, and group messages
            - heading "Desktop notification sounds" [level=4]
            - button "Desktop notification sounds Edit"
            - text: "\\"Bing\\" for messages"
            - heading "Email notifications" [level=4]
            - button "Email notifications Edit"
            - heading "Keywords that trigger notifications" [level=4]
            - button "Keywords that trigger notifications Edit"
            - text: "\\"@${user.username}\\", \\"@channel\\", \\"@all\\", \\"@here\\""
            - heading "Keywords that get highlighted (without notifications)" [level=4]
            - button "Keywords that get highlighted (without notifications) Edit"
            - heading "Troubleshooting notifications" [level=4]
            - paragraph: Not receiving notifications? Start by sending a test notification to all your devices to check if they’re working as expected. If issues persist, explore ways to solve them with troubleshooting steps.
            - button "Send a test notification"
            - button "Troubleshooting docs 󰏌"
        `);

        // * Analyze the Notifications settings panel for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include(settingsModal.notificationsSettings.id)
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
        const {user} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const globalHeader = channelsPage.globalHeader;
        const settingsModal = channelsPage.settingsModal;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal.container).toBeVisible();

        const notificationsSettings = settingsModal.notificationsSettings;

        // # Click Edit on Desktop and mobile notifications section
        await notificationsSettings.desktopAndMobileEditButton.click();

        // * Verify aria snapshot of Desktop and mobile notifications section when expanded
        await notificationsSettings.expandedSection.waitFor();
        await expect(notificationsSettings.expandedSection).toMatchAriaSnapshot({
            name: 'desktop_and_mobile_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(notificationsSettings.expandedSectionId)
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
        const {user} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const globalHeader = channelsPage.globalHeader;
        const settingsModal = channelsPage.settingsModal;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal.container).toBeVisible();

        const notificationsSettings = settingsModal.notificationsSettings;

        // # Click Edit on Desktop notification sounds section
        await notificationsSettings.desktopNotificationSoundEditButton.click();

        // * Verify aria snapshot of Desktop notification sounds section when expanded
        await notificationsSettings.expandedSection.waitFor();
        await expect(notificationsSettings.expandedSection).toMatchAriaSnapshot({
            name: 'desktop_notification_sounds_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(notificationsSettings.expandedSectionId)
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
        const {user} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const globalHeader = channelsPage.globalHeader;
        const settingsModal = channelsPage.settingsModal;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal.container).toBeVisible();

        const notificationsSettings = settingsModal.notificationsSettings;

        // # Click Edit on Email notifications section
        await notificationsSettings.emailEditButton.click();

        // * Verify aria snapshot of Email notifications section when expanded
        await notificationsSettings.expandedSection.waitFor();
        await expect(notificationsSettings.expandedSection).toMatchAriaSnapshot({
            name: 'email_notifications_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(notificationsSettings.expandedSectionId)
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
        const {user} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const globalHeader = channelsPage.globalHeader;
        const settingsModal = channelsPage.settingsModal;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal.container).toBeVisible();

        const notificationsSettings = settingsModal.notificationsSettings;

        // # Click Edit on Keywords that trigger notifications section
        await notificationsSettings.keywordsTriggerNotificationsEditButton.click();

        // * Verify aria snapshot of Keywords that trigger notifications section when expanded
        await notificationsSettings.expandedSection.waitFor();
        await expect(notificationsSettings.expandedSection).toMatchAriaSnapshot(`
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
            .include(notificationsSettings.expandedSectionId)
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
        const {user} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const globalHeader = channelsPage.globalHeader;
        const settingsModal = channelsPage.settingsModal;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal.container).toBeVisible();

        const notificationsSettings = settingsModal.notificationsSettings;

        // # Click Edit on Keywords that get highlighted (without notifications) section
        await notificationsSettings.keywordsGetHighlightedEditButton.click();

        // * Verify aria snapshot of Keywords that get highlighted (without notifications) section when expanded
        await notificationsSettings.expandedSection.waitFor();
        await expect(notificationsSettings.expandedSection).toMatchAriaSnapshot({
            name: 'keywords_that_get_highlighted_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(notificationsSettings.expandedSectionId)
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
