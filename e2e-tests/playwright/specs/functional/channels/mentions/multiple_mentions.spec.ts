// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('Multiple user mentions test', async ({pw}) => {
    const MENTION_COUNT = 20;

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

    await adminClient.addToTeam(team.id, mentionedUserID);

    // Get the town-square channel data
    const channels = await userClient.getMyChannels(team.id);
    const townSquare = channels.find((channel) => channel.name === 'town-square');

    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    // Use API to create all the mention posts
    for (let i = 0; i < MENTION_COUNT; i++) {
        const message = `Hey @${mentionedUser.username}, this is mention #${i + 1}`;
        await userClient.createPost({
            channel_id: townSquare.id,
            message,
            user_id: mentioningUser.id,
        });
    }

    // Login as the mentioned user to check mentions in the UI
    const {page: mentionedPage, channelsPage: mentionedChannelsPage} = await pw.testBrowser.login(mentionedUser);
    await mentionedChannelsPage.goto(team.name, 'town-square');
    await mentionedChannelsPage.toBeVisible();

    // Click on the Recent Mentions button in the channel header
    await mentionedPage.getByRole('button', {name: 'Recent mentions'}).click();

    // Wait for the RHS panel to be visible first
    await mentionedChannelsPage.sidebarRight.toBeVisible();

    // Get all the mention posts in the RHS
    const mentionPosts = mentionedChannelsPage.sidebarRight.container.locator('.post');

    // Verify we have the expected number of mention posts
    // Note: RHS might not load all 100 at once due to pagination, so we'll check
    // a sufficient number is loaded (at least the first page)
    await expect(mentionPosts).toHaveCount(MENTION_COUNT);

    // Verify the content of the first few mentions (most recent first)
    for (let i = 0; i < MENTION_COUNT; i++) {
        const mentionNumber = MENTION_COUNT - i;
        const expectedText = `Hey @${mentionedUser.username}, this is mention #${mentionNumber}`;
        await expect(mentionPosts.nth(i)).toContainText(expectedText);
    }
});
