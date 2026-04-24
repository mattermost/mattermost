// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

test(
    'navigate on keyboard tab between interactive elements',
    {tag: ['@accessibility', '@settings', '@notification_settings']},
    async ({pw}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);
        const notificationsSettings = settingsModal.notificationsSettings;

        // * Focus should be on the modal
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
        const {user, adminClient, page, settingsModal} = await setupAndOpenSettingsModal(pw);
        const clientConfig = await adminClient.getClientConfig();

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
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
