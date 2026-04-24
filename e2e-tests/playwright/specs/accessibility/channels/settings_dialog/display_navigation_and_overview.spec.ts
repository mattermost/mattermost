// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

/**
 * @objective Verify keyboard navigation through interactive elements in Display settings
 */
test(
    'navigate on keyboard tab between interactive elements',
    {tag: ['@accessibility', '@settings', '@display_settings']},
    async ({pw}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);
        const displaySettings = settingsModal.displaySettings;

        // * Focus should be on the modal
        await pw.toBeFocusedWithFocusVisible(settingsModal.container);

        // # Press Tab and verify focus is on Close button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(settingsModal.closeButton);

        // # Click on Display tab to open it
        await settingsModal.displayTab.click();

        // * Display Settings panel should be visible
        await expect(displaySettings.container).toBeVisible();

        // # Press Tab to move focus to first edit button (Theme)
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.themeEditButton);

        // # Press Tab to move focus to Clock Display button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.clockDisplayEditButton);

        // # Press Tab to move focus to Teammate Name Display button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.teammateNameDisplayEditButton);

        // # Press Tab to move focus to Show online availability button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.availabilityStatusOnPostsEditButton);

        // # Press Tab to move focus to Share last active time button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.lastActiveTimeEditButton);

        // # Press Tab to move focus to Timezone button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.timezoneEditButton);

        // # Press Tab to move focus to Website Link Previews button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.showLinkPreviewsEditButton);

        // # Press Tab to move focus to Default Appearance of Image Previews button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.collapseImagePreviewsEditButton);

        // # Press Tab to move focus to Message Display button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.messageDisplayEditButton);

        // # Press Tab to move focus to Click to open threads button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.clickToReplyEditButton);

        // # Press Tab to move focus to Channel Display button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.channelDisplayModeEditButton);

        // # Press Tab to move focus to Quick reactions button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.oneClickReactionsEditButton);

        // # Press Tab to move focus to Render emoticons button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.emojiPickerEditButton);

        // # Press Tab to move focus to Language button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.languageEditButton);
    },
);

/**
 * @objective Verify Display settings panel passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Display settings panel',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Display tab
        await settingsModal.displayTab.click();

        // * Display Settings panel should be visible
        await expect(settingsModal.displaySettings.container).toBeVisible();

        // * Verify aria snapshot of Display settings tab
        await expect(settingsModal.displaySettings.container).toMatchAriaSnapshot(`
          - tabpanel "display":
            - heading "Display Settings" [level=3]
            - heading "Theme" [level=4]
            - button "Theme Edit": Edit
            - text: /.+/
            - heading "Clock Display" [level=4]
            - button "Clock Display Edit": Edit
            - text: /.+/
            - heading "Teammate Name Display" [level=4]
            - button "Teammate Name Display Edit": Edit
            - text: /.+/
            - heading "Show online availability on profile images" [level=4]
            - button "Show online availability on profile images Edit": Edit
            - text: /.+/
            - heading "Share last active time" [level=4]
            - button "Share last active time Edit": Edit
            - text: /.+/
            - heading "Timezone" [level=4]
            - button "Timezone Edit": Edit
            - text: /.+/
            - heading "Website Link Previews" [level=4]
            - button "Website Link Previews Edit": Edit
            - text: /.+/
            - heading "Default Appearance of Image Previews" [level=4]
            - button "Default Appearance of Image Previews Edit": Edit
            - text: /.+/
            - heading "Message Display" [level=4]
            - button "Message Display Edit": Edit
            - text: /.+/
            - heading "Click to open threads" [level=4]
            - button "Click to open threads Edit": Edit
            - text: /.+/
            - heading "Channel Display" [level=4]
            - button "Channel Display Edit": Edit
            - text: /.+/
            - heading "Quick reactions on messages" [level=4]
            - button "Quick reactions on messages Edit": Edit
            - text: /.+/
            - heading "Render emoticons as emojis" [level=4]
            - button "Render emoticons as emojis Edit": Edit
            - text: /.+/
            - heading "Language" [level=4]
            - button "Language Edit": Edit
            - text: /.+/
        `);

        // * Analyze the Display settings panel for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include(settingsModal.displaySettings.id)
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Theme section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Theme section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Display tab
        await settingsModal.displayTab.click();

        const displaySettings = settingsModal.displaySettings;

        // # Click Edit on Theme section
        await displaySettings.themeEditButton.click();

        // * Verify aria snapshot of Theme section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Theme" [level=4]
          - group "Theme":
            - text: Theme
            - radio "Premade Themes" [checked]
            - text: Premade Themes
            - radio "Custom Theme"
            - text: Custom Theme
            - button /.*/
            - button /.*/
            - button /.*/
            - button /.*/
            - button /.*/
            - link "See other themes"
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(displaySettings.expandedSectionId)
            .disableRules(['color-contrast'])
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
