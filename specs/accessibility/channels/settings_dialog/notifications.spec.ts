// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test(
    'navigate on keyboard tab between interactive elements in Display Settings',
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

        // # Press Tab to move focus to Display tab
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(settingsModal.displayTab);

        // # Verify tab navigation through all interactive elements
        const editButtons = [
            displaySettings.themeEditButton,
            displaySettings.clockDisplayEditButton,
            displaySettings.teammateNameDisplayEditButton,
            displaySettings.availabilityStatusEditButton,
            displaySettings.lastActiveTimeEditButton,
            displaySettings.timezoneEditButton,
            displaySettings.linkPreviewsEditButton,
            displaySettings.imagePreviewsEditButton,
            displaySettings.messageDisplayEditButton,
            displaySettings.clickToReplyEditButton,
            displaySettings.channelDisplayEditButton,
            displaySettings.quickReactionsEditButton,
            displaySettings.renderEmotesEditButton,
            displaySettings.languageEditButton,
        ];

        for (const button of editButtons) {
            await page.keyboard.press('Tab');
            await pw.toBeFocusedWithFocusVisible(button);
        }
    },
);

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

        // * Verify aria snapshot of Display settings tab
        await expect(settingsModal.displaySettings.container).toMatchAriaSnapshot(`
            - tabpanel "display":
                - heading "Display" [level=3]
                - heading "Theme" [level=4]
                - button "Theme Edit"
                - heading "Clock Display" [level=4]
                - button "Clock Display Edit"
                - heading "Teammate Name Display" [level=4]
                - button "Teammate Name Display Edit"
                - heading "Show online availability on profile images" [level=4]
                - button "Show online availability on profile images Edit"
                - heading "Share last active time" [level=4]
                - button "Share last active time Edit"
                - heading "Timezone" [level=4]
                - button "Timezone Edit"
                - heading "Website Link Previews" [level=4]
                - button "Website Link Previews Edit"
                - heading "Default Appearance of Image Previews" [level=4]
                - button "Default Appearance of Image Previews Edit"
                - heading "Message Display" [level=4]
                - button "Message Display Edit"
                - heading "Click to open threads" [level=4]
                - button "Click to open threads Edit"
                - heading "Channel Display" [level=4]
                - button "Channel Display Edit"
                - heading "Quick reactions on messages" [level=4]
                - button "Quick reactions on messages Edit"
                - heading "Render emoticons as emojis" [level=4]
                - button "Render emoticons as emojis Edit"
                - heading "Language" [level=4]
                - button "Language Edit"
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
        const displaySettings = settingsModal.displaySettings;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Open settings modal
        await globalHeader.settingsButton.click();

        // # Click Edit on Theme section
        await displaySettings.themeEditButton.click();

        // * Verify aria snapshot of Theme section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot({
            name: 'theme_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(displaySettings.expandedSectionId)
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

test(
    'accessibility scan and aria-snapshot of Clock Display section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
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

        // # Open settings modal
        await globalHeader.settingsButton.click();

        // # Click Edit on Clock Display section
        await displaySettings.clockDisplayEditButton.click();

        // * Verify aria snapshot of Clock Display section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot({
            name: 'clock_display_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(displaySettings.expandedSectionId)
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

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
        const displaySettings = settingsModal.displaySettings;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Open settings modal
        await globalHeader.settingsButton.click();

        // # Click Edit on Timezone section
        await displaySettings.timezoneEditButton.click();

        // * Verify aria snapshot of Timezone section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot({
            name: 'timezone_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(displaySettings.expandedSectionId)
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

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
        const displaySettings = settingsModal.displaySettings;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Open settings modal
        await globalHeader.settingsButton.click();

        // # Click Edit on Language section
        await displaySettings.languageEditButton.click();

        // * Verify aria snapshot of Language section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot({
            name: 'language_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(displaySettings.expandedSectionId)
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
