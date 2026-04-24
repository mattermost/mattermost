// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

/**
 * @objective Verify Timezone section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Timezone section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
