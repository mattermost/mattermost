// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

/**
 * @objective Verify keyboard navigation through interactive elements in Advanced settings
 */
test(
    'navigate on keyboard tab between interactive elements',
    {tag: ['@accessibility', '@settings', '@advanced_settings']},
    async ({pw}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);
        const advancedSettings = settingsModal.advancedSettings;

        // * Focus should be on the modal
        await pw.toBeFocusedWithFocusVisible(settingsModal.container);

        // # Press Tab and verify focus is on Close button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(settingsModal.closeButton);

        // # Click on Advanced tab to open it
        await settingsModal.advancedTab.click();

        // * Advanced Settings panel should be visible
        await expect(advancedSettings.container).toBeVisible();

        // # Press Tab to move focus to Send Messages on CTRL+ENTER button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(advancedSettings.ctrlEnterEditButton);

        // # Press Tab to move focus to Enable Post Formatting button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(advancedSettings.postFormattingEditButton);

        // # Press Tab to move focus to Enable Join/Leave Messages button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(advancedSettings.joinLeaveEditButton);

        // # Press Tab to move focus to Scroll position button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(advancedSettings.scrollPositionEditButton);

        // # Press Tab to move focus to Allow message drafts to sync button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(advancedSettings.syncDraftsEditButton);
    },
);

/**
 * @objective Verify Advanced settings panel passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Advanced settings panel',
    {tag: ['@accessibility', '@settings', '@advanced_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Advanced tab
        await settingsModal.advancedTab.click();

        // * Advanced Settings panel should be visible
        await expect(settingsModal.advancedSettings.container).toBeVisible();

        // * Verify aria snapshot of Advanced settings tab
        await expect(settingsModal.advancedSettings.container).toMatchAriaSnapshot(`
          - tabpanel "advanced":
            - heading "Advanced Settings" [level=3]
            - heading /Send Messages on (CTRL|⌘)\\+ENTER/ [level=4]
            - button /Send Messages on (CTRL|⌘)\\+ENTER Edit/
            - text: /(On for all messages|On only for code blocks starting with \`\`\`|Off)/
            - heading "Enable Post Formatting" [level=4]
            - button "Enable Post Formatting Edit"
            - text: /(On|Off)/
            - heading "Enable Join/Leave Messages" [level=4]
            - button "Enable Join/Leave Messages Edit"
            - text: /(On|Off)/
            - heading "Scroll position when viewing an unread channel" [level=4]
            - button "Scroll position when viewing an unread channel Edit"
            - text: /(Start me where I left off|Start me at the newest message)/
            - heading "Allow message drafts to sync with the server" [level=4]
            - button "Allow message drafts to sync with the server Edit"
            - text: /(On|Off)/
        `);

        // * Analyze the Advanced settings panel for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include(settingsModal.advancedSettings.id)
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Send Messages on CTRL+ENTER section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Send Messages on CTRL+ENTER section',
    {tag: ['@accessibility', '@settings', '@advanced_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Advanced tab
        await settingsModal.advancedTab.click();

        const advancedSettings = settingsModal.advancedSettings;

        // # Click Edit on Send Messages section
        await advancedSettings.ctrlEnterEditButton.click();

        // * Verify aria snapshot of Send Messages section when expanded
        await advancedSettings.expandedSection.waitFor();
        await expect(advancedSettings.expandedSection).toMatchAriaSnapshot(`
          - heading /Send Messages on (CTRL|⌘)\\+ENTER/ [level=4]
          - group /Send Messages on (CTRL|⌘)\\+ENTER/:
            - text: /Send Messages on (CTRL|⌘)\\+ENTER/
            - radio "On for all messages"
            - text: On for all messages
            - radio /(On only for code blocks starting with \`\`\`|On only for code blocks starting with \\\`\\\`\\\`)/ [checked]
            - text: /(On only for code blocks starting with \`\`\`|On only for code blocks starting with \\\`\\\`\\\`)/
            - radio "Off"
            - text: /Off When enabled, (CTRL|⌘) \\+ ENTER will send the message and ENTER inserts a new line\\./
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
