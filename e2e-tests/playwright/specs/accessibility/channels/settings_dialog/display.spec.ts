// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify keyboard navigation through interactive elements in Display settings
 */
test(
    'navigate on keyboard tab between interactive elements',
    {tag: ['@accessibility', '@settings', '@display_settings']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const globalHeader = channelsPage.globalHeader;
        const settingsModal = channelsPage.settingsModal;
        const displaySettings = settingsModal.displaySettings;

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

        // # Click on Display tab to open it
        await settingsModal.displayTab.click();

        // * Display Settings panel should be visible
        await expect(displaySettings.container).toBeVisible();

        // # Press Tab to move focus to first edit button (Theme)
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(displaySettings.themeEditButton);

        // # Continue pressing Tab until we reach Timezone button (skipping intermediate sections)
        // There are several edit buttons between Theme and Timezone
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Tab');
        }
        await pw.toBeFocusedWithFocusVisible(displaySettings.timezoneEditButton);

        // # Continue pressing Tab until we reach Language button (skipping intermediate sections)
        // There are several edit buttons between Timezone and Language
        for (let i = 0; i < 8; i++) {
            await page.keyboard.press('Tab');
        }
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

        // # Open Display tab
        await settingsModal.displayTab.click();

        // * Display Settings panel should be visible
        await expect(settingsModal.displaySettings.container).toBeVisible();

        // * Verify aria snapshot of Display settings tab
        await expect(settingsModal.displaySettings.container).toMatchAriaSnapshot(`
          - tabpanel "display":
            - heading "Display Settings" [level=3]
            - heading "Theme" [level=4]
            - button "Theme Edit"
            - text: /.*/
            - heading "Clock Display" [level=4]
            - button "Clock Display Edit"
            - text: /.*/
            - heading "Teammate Name Display" [level=4]
            - button "Teammate Name Display Edit"
            - text: /.*/
            - heading "Show online availability on profile images" [level=4]
            - button "Show online availability on profile images Edit"
            - text: /.*/
            - heading "Share last active time" [level=4]
            - button "Share last active time Edit"
            - text: /.*/
            - heading "Timezone" [level=4]
            - button "Timezone Edit"
            - text: /.*/
            - heading "Website Link Previews" [level=4]
            - button "Website Link Previews Edit"
            - text: /.*/
            - heading "Default Appearance of Image Previews" [level=4]
            - button "Default Appearance of Image Previews Edit"
            - text: /.*/
            - heading "Message Display" [level=4]
            - button "Message Display Edit"
            - text: /.*/
            - heading "Click to open threads" [level=4]
            - button "Click to open threads Edit"
            - text: /.*/
            - heading "Channel Display" [level=4]
            - button "Channel Display Edit"
            - text: /.*/
            - heading "Quick reactions on messages" [level=4]
            - button "Quick reactions on messages Edit"
            - text: /.*/
            - heading "Render emoticons as emojis" [level=4]
            - button "Render emoticons as emojis Edit"
            - text: /.*/
            - heading "Language" [level=4]
            - button "Language Edit"
            - text: /.*/
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

/**
 * @objective Verify Timezone section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Timezone section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
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

        // # Open Display tab
        await settingsModal.displayTab.click();

        const displaySettings = settingsModal.displaySettings;

        // # Click Edit on Timezone section
        await displaySettings.timezoneEditButton.click();

        // * Verify aria snapshot of Timezone section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Timezone" [level=4]
          - checkbox "Automatic" [checked]
          - text: Automatic
          - log
          - text: /.*/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(displaySettings.expandedSectionId)
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Language section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Language section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
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

        // # Open Display tab
        await settingsModal.displayTab.click();

        const displaySettings = settingsModal.displaySettings;

        // # Click Edit on Language section
        await displaySettings.languageEditButton.click();

        // * Verify aria snapshot of Language section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Language" [level=4]
          - text: /.*/
          - log
          - text: /.*/
          - combobox /.*/
          - text: /.*/
          - paragraph
          - text: /.*/
          - link "Mattermost Translation Server"
          - text: /.*/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(displaySettings.expandedSectionId)
            .disableRules(['color-contrast', 'link-in-text-block'])
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
