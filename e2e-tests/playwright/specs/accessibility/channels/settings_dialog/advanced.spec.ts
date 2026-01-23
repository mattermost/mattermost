// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify keyboard navigation through interactive elements in Advanced settings
 */
test(
    'navigate on keyboard tab between interactive elements',
    {tag: ['@accessibility', '@settings', '@advanced_settings']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const globalHeader = channelsPage.globalHeader;
        const settingsModal = channelsPage.settingsModal;
        const advancedSettings = settingsModal.advancedSettings;

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

/**
 * @objective Verify Enable Post Formatting section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Enable Post Formatting section',
    {tag: ['@accessibility', '@settings', '@advanced_settings', '@snapshots']},
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

        // # Open Advanced tab
        await settingsModal.advancedTab.click();

        const advancedSettings = settingsModal.advancedSettings;

        // # Click Edit on Enable Post Formatting section
        await advancedSettings.postFormattingEditButton.click();

        // * Verify aria snapshot of Enable Post Formatting section when expanded
        await advancedSettings.expandedSection.waitFor();
        await expect(advancedSettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Enable Post Formatting" [level=4]
          - group "Enable Post Formatting":
            - radio /(On|Off)/ [checked]
            - text: /(On|Off)/
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
 * @objective Verify Enable Join/Leave Messages section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Enable Join/Leave Messages section',
    {tag: ['@accessibility', '@settings', '@advanced_settings', '@snapshots']},
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

        // # Open Advanced tab
        await settingsModal.advancedTab.click();

        const advancedSettings = settingsModal.advancedSettings;

        // # Click Edit on Enable Join/Leave Messages section
        await advancedSettings.joinLeaveEditButton.click();

        // * Verify aria snapshot of Enable Join/Leave Messages section when expanded
        await advancedSettings.expandedSection.waitFor();
        await expect(advancedSettings.expandedSection).toMatchAriaSnapshot(`
          - heading "Enable Join/Leave Messages" [level=4]
          - group "Enable Join/Leave Messages":
            - text: Enable Join/Leave Messages
            - radio "On" [checked]
            - text: "On"
            - radio "Off"
            - text: /Off When "On", System Messages saying a user has joined or left a channel will be visible\\./
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
 * @objective Verify Scroll position section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Scroll position section',
    {tag: ['@accessibility', '@settings', '@advanced_settings', '@snapshots']},
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
