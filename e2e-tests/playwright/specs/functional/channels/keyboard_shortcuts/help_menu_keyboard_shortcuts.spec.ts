// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that selecting "Keyboard shortcuts" from the Help menu opens the Keyboard Shortcuts modal.
 */
test('MM-T1279 opens keyboard shortcuts modal from the Help menu', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open the Help menu and click "Keyboard shortcuts"
    await channelsPage.globalHeader.openKeyboardShortcuts();

    // * Verify the Keyboard Shortcuts modal is displayed
    await expect(channelsPage.keyboardShortcutsModal).toBeVisible();

    // # Close the modal with the Escape key
    await channelsPage.page.keyboard.press('Escape');

    // * Verify the Keyboard Shortcuts modal is no longer displayed
    await expect(channelsPage.keyboardShortcutsModal).not.toBeVisible();
});
