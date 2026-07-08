// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a leading colon is ignored when searching in the emoji picker.
 */
test('MM-T156 ignores a leading colon when searching the emoji picker', {tag: '@messaging'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message and open the emoji reaction picker on it
    await channelsPage.postMessage(`emoji picker search ${pw.random.id()}`);
    const post = await channelsPage.getLastPost();
    await post.openReactionPicker();

    // * Verify the emoji picker is open
    await channelsPage.reactionEmojiPicker.toBeVisible();

    // # Search using a leading colon
    await channelsPage.reactionEmojiPicker.searchEmoji(':tax');

    // * Verify the leading colon is ignored and the taxi emoji is returned
    await expect(channelsPage.reactionEmojiPicker.getEmoji('taxi')).toBeVisible();
});
