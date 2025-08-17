// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that multiple user mentions are displayed properly in the Recent Mentions section.
 *
 * @precondition
 * Two users must be members of the same team
 */
test('displays multiple mentions correctly in Recent Mentions panel', {tag: '@mentions'}, async ({pw}) => {
    // # Define the number of mentions to create
    const MENTION_COUNT = 20;

    // # Initialize the first user who will create the mentions
    const {
        team,
        user: mentioningUser,
        userClient,
    } = await pw.initSetup({
        userPrefix: 'mentioner',
    });

    // # Create a second user to be mentioned
    const {adminClient} = await pw.getAdminClient();
    const mentionedUser = pw.random.user('mentioned');
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
            user_id: mentioningUser.id,
        });
    }

    // # Login as the mentioned user to check mentions in the UI
    const {page: mentionedPage, channelsPage: mentionedChannelsPage} = await pw.testBrowser.login(mentionedUser);
    await mentionedChannelsPage.goto(team.name, 'town-square');
    await mentionedChannelsPage.toBeVisible();

    // # Click on the Recent Mentions button in the channel header
    await mentionedPage.getByRole('button', {name: 'Recent mentions'}).click();

    // * Verify the right sidebar opens and is visible
    await mentionedChannelsPage.sidebarRight.toBeVisible();

    // # Get all the mention posts in the right sidebar
    const mentionPosts = mentionedChannelsPage.sidebarRight.container.locator('.post');

    // * Verify the correct number of mention posts are displayed
    await expect(mentionPosts).toHaveCount(MENTION_COUNT);

    // * Verify the content of each mention displays correctly with the right mention text
    for (let i = 0; i < MENTION_COUNT; i++) {
        const mentionNumber = MENTION_COUNT - i;
        const expectedText = `Hey @${mentionedUser.username}, this is mention #${mentionNumber}`;
        await expect(mentionPosts.nth(i)).toContainText(expectedText);
    }
});
