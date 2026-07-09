// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that pressing Tab completes the highlighted at-mention suggestion in the message box.
 */
test('MM-T1273 completes at-mention autocomplete with Tab', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Type the first characters of the user's own username to trigger the mention autocomplete
    const {postCreate} = channelsPage.centerView;
    await postCreate.selectFromAutocompleteWithTab(`@${user.username.substring(0, 5)}`);

    // * Verify the highlighted username is completed into the message box
    expect(await postCreate.getInputValue()).toContain(`@${user.username}`);
});

/**
 * @objective Verify that pressing Tab completes the highlighted emoji suggestion in the message box.
 */
test('MM-T1274 completes emoji autocomplete with Tab', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Type a partial emoji name to trigger the emoji autocomplete, then select with Tab
    const {postCreate} = channelsPage.centerView;
    await postCreate.selectFromAutocompleteWithTab(':tomato');

    // * Verify the highlighted emoji is completed into the message box.
    // Current behavior inserts the rendered emoji glyph rather than the `:tomato:` shortcode.
    expect(await postCreate.getInputValue()).toContain('🍅');
});
