// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

/**
 * @objective Verify Teammate Name Display section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Teammate Name Display section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
