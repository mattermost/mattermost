// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that multiple user mentions are displayed properly in the Recent Mentions section.
 *
 *
 * @precondition
 * Two users must be members of the same team
 */
test('displays multiple mentions correctly in Recent Mentions panel', {tag: ['@smoke', '@mentions']}, async ({pw}) => {
    // # Define the number of mentions to create
    const MENTION_COUNT = 20;

    // # Initialize the first user who will create the mentions
    const {team, userClient} = await pw.initSetup({userOptions: {prefix: 'mentioner'}});

    // # Create a second user to be mentioned
    const {adminClient} = await pw.getAdminClient();
    const mentionedUser = await pw.random.user('mentioned');
    const {id: mentionedUserID} = await adminClient.createUser(mentionedUser, '', '');

    // # Add the mentioned user to the team
    await adminClient.addToTeam(team.id, mentionedUserID);

    // # Get the town-square channel data
    const channels = await userClient.getMyChannels(team.id);
    const townSquare = channels.find((channel) => channel.name === 'town-square');

    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    // # Create multiple posts that mention the second user
    for (let i = 0; i < MENTION_COUNT; i++) {
        const message = `Hey @${mentionedUser.username}, this is mention #${i + 1}`;
        await userClient.createPost({
            channel_id: townSquare.id,
            message,
        });
    }

    // # Login as the mentioned user to check mentions in the UI
    const {app} = await pw.testBrowser.login(mentionedUser);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open Recent mentions
    await app.globalHeader.recentMentionsButton.click();

    // * Verify every mention is listed, newest first
    const results = app.search.results;
    await expect.poll(async () => (await results.postList.keys()).length).toBe(MENTION_COUNT);
    const keys = await results.postList.keys();
    for (let i = 0; i < MENTION_COUNT; i++) {
        const mentionNumber = MENTION_COUNT - i;
        const expectedText = `Hey @${mentionedUser.username}, this is mention #${mentionNumber}`;
        await expect(results.post({id: keys[i]}).message.container).toHaveText(expectedText);
    }
});
