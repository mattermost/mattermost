// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the "in:" search modifier autocompletes a direct-message user and returns matching DM posts.
 */
test('MM-T358 searches for a message in a direct message channel', {tag: '@search'}, async ({pw}) => {
    // # Create a direct message and a uniquely searchable post
    const {user, team, adminClient, townSquare} = await pw.initSetup();
    const [otherUser] = await adminClient.createUsers(team.id, 1, 'dm-user');
    const dmChannel = await adminClient.createDirectChannel([user.id, otherUser.id]);
    const message = `Hello${pw.random.id()}`;
    const dmPost = await pw.postAs(user, {channel_id: dmChannel.id, message});
    const channelPost = await pw.postAs(user, {channel_id: townSquare.id, message});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});
    const input = app.searchBox.inputSearchbox;

    // # Type the in: modifier and select the other user from the autocomplete
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await input.fill('in:');
    await app.searchBox.suggestions.suggestion(`@${otherUser.username}`).select();

    // * Verify the direct-message user is placed into the query
    await expect(input).toHaveValue(`in:@${otherUser.username} `);

    // # Add the message text and submit the search
    await input.type(message);
    await input.press('Enter');

    // * Verify only the direct message is returned
    await expect(app.search.results.post(dmPost)).toBeVisible();
    await expect(app.search.results.post(channelPost)).toHaveCount(0);
});
