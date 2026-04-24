// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

/**
 * @objective Verify Scroll position section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Scroll position section',
    {tag: ['@accessibility', '@settings', '@advanced_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Advanced tab
        await settingsModal.advancedTab.click();

        const advancedSettings = settingsModal.advancedSettings;

        // # Click Edit on Scroll position section
        await advancedSettings.scrollPositionEditButton.click();

        // * Verify aria snapshot of Scroll position section when expanded
        await advancedSettings.expandedSection.waitFor();
        await expect(advancedSettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Scroll position when viewing an unread channel" [level=4]
          - group "Scroll position when viewing an unread channel":
            - text: Scroll position when viewing an unread channel
            - radio "Start me where I left off" [checked]
            - text: Start me where I left off
            - radio "Start me at the newest message"
            - text: /Start me at the newest message Choose your scroll position when you view an unread channel\\./
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(advancedSettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify message drafts sync section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Allow message drafts to sync section',
    {tag: ['@accessibility', '@settings', '@advanced_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Advanced tab
        await settingsModal.advancedTab.click();

        const advancedSettings = settingsModal.advancedSettings;

        // # Click Edit on Allow message drafts to sync section
        await advancedSettings.syncDraftsEditButton.click();

        // * Verify aria snapshot of Allow message drafts to sync section when expanded
        await advancedSettings.expandedSection.waitFor();
        await expect(advancedSettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Allow message drafts to sync with the server" [level=4]
          - group "Allow message drafts to sync with the server":
            - text: Allow message drafts to sync with the server
            - radio "On" [checked]
            - text: "On"
            - radio "Off"
            - text: /Off When enabled, message drafts are synced with the server/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(advancedSettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
