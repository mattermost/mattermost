// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

test(
    'accessibility scan and aria-snapshot of Keywords that trigger notifications section',
    {tag: ['@accessibility', '@settings', '@notification_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {user, page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
