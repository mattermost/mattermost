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
          - text: /.+ Select the timezone used for timestamps in the user interface and email notifications./
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

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
          - text: /.+/
          - log
          - text: /.+/
          - combobox /.+/
          - text: Select which language Mattermost displays in the user interface.
          - paragraph
          - text: /.+/
          - link "Mattermost Translation Server"
          - text: /.+/
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

/**
 * @objective Verify Clock Display section passes accessibility scan and matches aria-snapshot
 */
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

        // # Click Edit on Clock Display section
        await displaySettings.clockDisplayEditButton.click();

        // * Verify aria snapshot of Clock Display section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Clock Display" [level=4]
          - group "Clock Display":
            - text: Clock Display
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Teammate Name Display section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Teammate Name Display section',
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

        // # Click Edit on Teammate Name Display section
        await displaySettings.teammateNameDisplayEditButton.click();

        // * Verify aria snapshot of Teammate Name Display section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Teammate Name Display" [level=4]
          - group "Teammate Name Display":
            - text: Teammate Name Display
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Message Display section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Message Display section',
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

        // # Click Edit on Message Display section
        await displaySettings.messageDisplayEditButton.click();

        // * Verify aria snapshot of Message Display section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Message Display" [level=4]
          - group "Message Display":
            - text: Message Display
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Channel Display section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Channel Display section',
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

        // # Click Edit on Channel Display section
        await displaySettings.channelDisplayModeEditButton.click();

        // * Verify aria snapshot of Channel Display section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Channel Display" [level=4]
          - group "Channel Display":
            - text: Channel Display
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Show online availability section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Show online availability section',
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

        // # Click Edit on Show online availability section
        await displaySettings.availabilityStatusOnPostsEditButton.click();

        // * Verify aria snapshot of Show online availability section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Show online availability on profile images" [level=4]
          - group "Show online availability on profile images":
            - text: Show online availability on profile images
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Share last active time section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Share last active time section',
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

        // # Click Edit on Share last active time section
        await displaySettings.lastActiveTimeEditButton.click();

        // * Verify aria snapshot of Share last active time section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Share last active time" [level=4]
          - group "Share last active time":
            - text: Share last active time
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Website Link Previews section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Website Link Previews section',
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

        // # Click Edit on Website Link Previews section
        await displaySettings.showLinkPreviewsEditButton.click();

        // * Verify aria snapshot of Website Link Previews section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Website Link Previews" [level=4]
          - group "Website Link Previews":
            - text: Website Link Previews
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Default Appearance of Image Previews section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Default Appearance of Image Previews section',
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

        // # Click Edit on Default Appearance of Image Previews section
        await displaySettings.collapseImagePreviewsEditButton.scrollIntoViewIfNeeded();
        await displaySettings.collapseImagePreviewsEditButton.click();

        // * Verify aria snapshot of Default Appearance of Image Previews section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Default Appearance of Image Previews" [level=4]
          - group "Default Appearance of Image Previews":
            - text: Default Appearance of Image Previews
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Click to open threads section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Click to open threads section',
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

        // # Click Edit on Click to open threads section
        await displaySettings.clickToReplyEditButton.click();

        // * Verify aria snapshot of Click to open threads section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Click to open threads" [level=4]
          - group "Click to open threads":
            - text: Click to open threads
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Quick reactions on messages section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Quick reactions on messages section',
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

        // # Click Edit on Quick reactions on messages section
        await displaySettings.oneClickReactionsEditButton.click();

        // * Verify aria snapshot of Quick reactions on messages section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Quick reactions on messages" [level=4]
          - group "Quick reactions on messages":
            - text: Quick reactions on messages
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Render emoticons as emojis section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Render emoticons as emojis section',
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

        // # Click Edit on Render emoticons as emojis section
        await displaySettings.emojiPickerEditButton.click();

        // * Verify aria snapshot of Render emoticons as emojis section when expanded
        await displaySettings.expandedSection.waitFor();
        await expect(displaySettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Render emoticons as emojis" [level=4]
          - group "Render emoticons as emojis":
            - text: Render emoticons as emojis
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(displaySettings.expandedSectionId).analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
