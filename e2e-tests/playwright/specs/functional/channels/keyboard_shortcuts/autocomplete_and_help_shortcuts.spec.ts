// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that pressing Tab completes the highlighted at-mention suggestion in the message box.
 */
test('MM-T1273 completes at-mention autocomplete with Tab', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Type the first characters of the user's own username to trigger the mention autocomplete
    const message = app.center.postCreate.message;
    await message.container.fill(`@${user.username.substring(0, 5)}`);
    await expect(message.suggestions.suggestion(`@${user.username}`)).toBeVisible();
    await message.container.press('Tab');

    // * Verify the highlighted username is completed into the message box
    await expect(message.container).toHaveValue(new RegExp(`@${user.username}`));
});

/**
 * @objective Verify that pressing Tab completes the highlighted emoji suggestion in the message box.
 */
test('MM-T1274 completes emoji autocomplete with Tab', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Type a partial emoji name to trigger the emoji autocomplete, then select with Tab
    const message = app.center.postCreate.message;
    await message.container.fill(':tomato');
    await expect(message.suggestions.suggestion('🍅')).toBeVisible();
    await message.container.press('Tab');

    // * Verify the highlighted emoji is completed into the message box.
    // Current behavior inserts the rendered emoji glyph rather than the `:tomato:` shortcode.
    await expect(message.container).toHaveValue(/🍅/);
});

/**
 * @objective Verify that selecting "Keyboard shortcuts" from the Help menu opens the Keyboard Shortcuts modal.
 */
test('MM-T1279 opens keyboard shortcuts modal from the Help menu', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the Help menu and click "Keyboard shortcuts"
    const help = app.globalHeader.helpMenu;
    await app.globalHeader.helpButton.clickTo(help.keyboardShortcutsMenuItem);
    await help.keyboardShortcutsMenuItem.clickTo(app.keyboardShortcutsModal);

    // * Verify the Keyboard Shortcuts modal is displayed
    await expect(app.keyboardShortcutsModal).toBeVisible();

    // # Close the modal with the Escape key
    await app.page.keyboard.press('Escape');

    // * Verify the Keyboard Shortcuts modal is no longer displayed
    await expect(app.keyboardShortcutsModal).not.toBeVisible();
});
