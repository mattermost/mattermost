// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

/**
 * @objective Verify Show online availability section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Show online availability section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
