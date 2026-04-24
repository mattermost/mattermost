// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, PlaywrightExtended} from '@mattermost/playwright-lib';

/**
 * Shared helpers for accessibility specs under `settings_dialog/`.
 *
 * Most specs in this folder share the same prologue:
 *   1. Initialize setup (create user).
 *   2. Log in user in new browser context.
 *   3. Visit default channel page.
 *   4. Focus the global header Settings button and press Enter to open the settings modal.
 *   5. Expect the settings modal container to be visible.
 *
 * These helpers wrap that prologue so each spec can focus only on what makes
 * it unique (which tab to open, which section to expand, etc.).
 */

/**
 * Initialize a new user, log in, visit default channel and open the
 * Settings modal via the keyboard (focus + Enter on the Settings button).
 *
 * Returns a handle bag containing the most commonly used references.
 */
export async function setupAndOpenSettingsModal(pw: PlaywrightExtended) {
    // # Create and sign in a new user
    const {user, adminClient, team} = await pw.initSetup();

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

    return {user, adminClient, team, page, channelsPage, globalHeader, settingsModal};
}

/**
 * Rules disabled by whole-panel accessibility scans of the Settings modal.
 *
 * `aria-required-children` and `aria-required-parent` are known false positives
 * caused by how setting tabs are grouped in the LHS.
 */
export const SETTINGS_PANEL_DISABLED_RULES = [
    'color-contrast',

    // Known issue: These fail due to the way setting tabs are grouped.
    'aria-required-children',
    'aria-required-parent',
];
