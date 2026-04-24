// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {SETTINGS_PANEL_DISABLED_RULES, setupAndOpenSettingsModal} from './support';

/**
 * @objective Verify that display settings panel meets WCAG accessibility standards
 */
test(
    'passes accessibility scan on display settings panel',
    {tag: ['@accessibility', '@settings']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Display tab
        await settingsModal.openDisplayTab();

        // * Display Settings panel should be visible
        await expect(settingsModal.displaySettings.container).toBeVisible();

        // * Analyze the Settings modal with display panel
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .disableRules(SETTINGS_PANEL_DISABLED_RULES)
            .include(settingsModal.getContainerId())
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify that sidebar settings panel meets WCAG accessibility standards
 */
test(
    'passes accessibility scan on sidebar settings panel',
    {tag: ['@accessibility', '@settings']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Sidebar tab
        await settingsModal.openSidebarTab();

        // * Sidebar Settings panel should be visible
        await expect(settingsModal.sidebarSettings.container).toBeVisible();

        // * Analyze the Settings modal with sidebar panel
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .disableRules(SETTINGS_PANEL_DISABLED_RULES)
            .include(settingsModal.getContainerId())
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify that advanced settings panel meets WCAG accessibility standards
 */
test(
    'passes accessibility scan on advanced settings panel',
    {tag: ['@accessibility', '@settings']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // # Open Advanced tab
        await settingsModal.openAdvancedTab();

        // * Advanced Settings panel should be visible
        await expect(settingsModal.advancedSettings.container).toBeVisible();

        // * Analyze the Settings modal with advanced panel
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .disableRules(SETTINGS_PANEL_DISABLED_RULES)
            .include(settingsModal.getContainerId())
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
