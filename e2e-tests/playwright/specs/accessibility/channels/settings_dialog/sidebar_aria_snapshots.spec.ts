// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

/**
 * @objective Verify the Sidebar settings panel passes accessibility scan and matches aria snapshot
 */
test(
    'accessibility scan and aria-snapshot of Sidebar settings panel',
    {tag: ['@accessibility', '@settings', '@sidebar_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Sidebar tab
        await settingsModal.openSidebarTab();

        // * Verify aria snapshot of Sidebar settings tab
        await expect(settingsModal.sidebarSettings.container).toMatchAriaSnapshot(`
          - tabpanel "sidebar":
            - heading "Sidebar Settings" [level=3]
            - heading "Group unread channels separately" [level=4]
            - button "Group unread channels separately Edit": Edit
            - text: "Off"
            - heading "Number of direct messages to show" [level=4]
            - button "Number of direct messages to show Edit": Edit
            - text: "40"
        `);

        // * Analyze the Sidebar settings panel for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include(settingsModal.sidebarSettings.id)
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
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Sidebar tab
        await settingsModal.openSidebarTab();

        const sidebarSettings = settingsModal.sidebarSettings;

        // # Click Edit on Group unread channels separately section
        await sidebarSettings.groupUnreadEditButton.click();

        // * Verify aria snapshot of Group unread channels separately section when expanded
        await sidebarSettings.expandedSection.waitFor();
        await expect(sidebarSettings.expandedSection).toMatchAriaSnapshot({
            name: 'group_unread_channels_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe.builder(page).include(sidebarSettings.expandedSectionId).analyze();

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
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Sidebar tab
        await settingsModal.openSidebarTab();

        const sidebarSettings = settingsModal.sidebarSettings;

        // # Click Edit on Number of direct messages to show section
        await sidebarSettings.limitVisibleDMsEditButton.click();

        // * Verify aria snapshot of Number of direct messages to show section when expanded
        await sidebarSettings.expandedSection.waitFor();
        await expect(sidebarSettings.expandedSection).toMatchAriaSnapshot({
            name: 'number_of_direct_messages_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(sidebarSettings.expandedSectionId)
            .exclude('#react-select-2-input') // Exclude react-select input that has a known accessibility issue
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
