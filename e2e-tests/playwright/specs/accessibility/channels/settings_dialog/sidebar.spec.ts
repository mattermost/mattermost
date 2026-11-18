// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {focusVisible} from '../focus_support';

import {selectorOf} from './support';

/**
 * @objective Verify keyboard navigation works correctly through all interactive elements in the Sidebar settings panel
 */
test(
    'navigate on keyboard tab between interactive elements',
    {tag: ['@accessibility', '@settings', '@sidebar_settings']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible and focus should be on the modal
        await expect(settingsModal).toBeVisible();
        await expect.poll(() => focusVisible(settingsModal)).toBe(true);

        // # Press Tab and verify focus is on Close button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(settingsModal.closeButton)).toBe(true);

        // # Press Tab to move focus to Notifications tab
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(settingsModal.tabs.tab('notifications'))).toBe(true);

        // # Press ArrowDown to navigate to Display tab
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => focusVisible(settingsModal.tabs.tab('display'))).toBe(true);

        // # Press ArrowDown to navigate to Sidebar tab
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => focusVisible(settingsModal.tabs.tab('sidebar'))).toBe(true);

        // # Press Tab to move focus to Group unread channels separately button
        await page.keyboard.press('Tab');
        await expect
            .poll(() => focusVisible(app.settings.sidebar.section('showUnreadsCategory').editButton))
            .toBe(true);

        // # Press Tab to move focus to Number of direct messages to show button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.sidebar.section('limitVisibleGMsDMs').editButton)).toBe(true);
    },
);

/**
 * @objective Verify the Sidebar settings panel passes accessibility scan and matches aria snapshot
 */
test(
    'accessibility scan and aria-snapshot of Sidebar settings panel',
    {tag: ['@accessibility', '@settings', '@sidebar_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Sidebar tab
        await settingsModal.tabs.tab('sidebar').select();
        await expect(settingsModal.tabs.tab('sidebar')).toBeSelected();
        await expect(app.settings.panel('sidebar')).toBeVisible();

        // * Verify aria snapshot of Sidebar settings tab
        await expect(app.settings.panel('sidebar')).toMatchAriaSnapshot(`
          - tabpanel "sidebar":
            - heading "Sidebar Settings" [level=3]
            - group:
              - heading "Group unread channels separately" [level=4]
              - button "Group unread channels separately Edit": Edit
              - text: "Off"
            - group:
              - heading "Number of direct messages to show" [level=4]
              - button "Number of direct messages to show Edit": Edit
              - text: "40"
        `);

        // * Analyze the Sidebar settings panel for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include(selectorOf(app.settings.panel('sidebar')))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify the Group unread channels separately section passes accessibility scan when expanded
 */
test(
    'accessibility scan and aria-snapshot of Group unread channels separately section',
    {tag: ['@accessibility', '@settings', '@sidebar_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Sidebar tab
        await settingsModal.tabs.tab('sidebar').select();
        await expect(settingsModal.tabs.tab('sidebar')).toBeSelected();
        await expect(app.settings.panel('sidebar')).toBeVisible();

        // # Click Edit on Group unread channels separately section
        await app.settings.sidebar.section('showUnreadsCategory').editButton.click();

        // * Verify aria snapshot of Group unread channels separately section when expanded
        await expect(app.settings.sidebar.section('showUnreadsCategory')).toBeVisible();
        await expect(app.settings.sidebar.section('showUnreadsCategory')).toMatchAriaSnapshot({
            name: 'group_unread_channels_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.sidebar.section('showUnreadsCategory').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify the Number of direct messages to show section passes accessibility scan when expanded
 */
test(
    'accessibility scan and aria-snapshot of Number of direct messages to show section',
    {tag: ['@accessibility', '@settings', '@sidebar_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Sidebar tab
        await settingsModal.tabs.tab('sidebar').select();
        await expect(settingsModal.tabs.tab('sidebar')).toBeSelected();
        await expect(app.settings.panel('sidebar')).toBeVisible();

        // # Click Edit on Number of direct messages to show section
        await app.settings.sidebar.section('limitVisibleGMsDMs').editButton.click();

        // * Verify aria snapshot of Number of direct messages to show section when expanded
        await expect(app.settings.sidebar.section('limitVisibleGMsDMs')).toBeVisible();
        await expect(app.settings.sidebar.section('limitVisibleGMsDMs')).toMatchAriaSnapshot({
            name: 'number_of_direct_messages_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.sidebar.section('limitVisibleGMsDMs').container))
            .exclude('#react-select-2-input') // Exclude react-select input that has a known accessibility issue
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
