// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

/**
 * @objective Verify Enable Post Formatting section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Enable Post Formatting section',
    {tag: ['@accessibility', '@settings', '@advanced_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

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
