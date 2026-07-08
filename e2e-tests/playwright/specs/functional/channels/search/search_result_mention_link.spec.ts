// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a full username containing '-' or '_' is shown as a mention link in the mentioned user's search results.
 */
test('MM-T348 shows a full special-character username as a link in search results', {tag: '@search'}, async ({pw}) => {
    // # Create a user whose username contains '-' and '_', plus a user who mentions them
    const {user: mentioningUser, team, adminClient, userClient} = await pw.initSetup();
    const [specialUser] = await adminClient.createUsers(team.id, 1, 'test-user_');
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    await adminClient.addToChannel(specialUser.id, townSquare.id);

    // # The first user posts a message mentioning the special-character username
    const token = `mention${pw.random.id()}`;
    await userClient.createPost({
        channel_id: townSquare.id,
        message: `@${specialUser.username} ${token}`,
        user_id: mentioningUser.id,
    });

    // # Log in as the mentioned user and open Recent Mentions
    const {channelsPage} = await pw.testBrowser.login(specialUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.globalHeader.openRecentMentions();

    // * Verify the mention shows the full username as a clickable mention (rendered as a button)
    await channelsPage.searchResultsPanel.toBeVisible();
    const result = channelsPage.searchResultsPanel.getResultByText(token);
    await expect(result.getByRole('button', {name: `@${specialUser.username}`})).toBeVisible();
});
