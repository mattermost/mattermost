// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelsPage} from '@mattermost/playwright-lib';
import {expect, test} from '@mattermost/playwright-lib';

async function searchAndExpect(channelsPage: ChannelsPage, query: string, expectedMessages: string[]) {
    await channelsPage.searchFor(query);
    await expect(channelsPage.searchResultsPanel.getResultItems()).toHaveCount(expectedMessages.length);
    for (const message of expectedMessages) {
        await expect(channelsPage.searchResultsPanel.getResultByText(message)).toBeVisible();
    }
}

/**
 * @objective Verify the on: date filter combines correctly with in: and from: search filters.
 */
test('MM-T3994_1 MM-T3994_2 MM-T3994_3 combines on: with in: and from: filters', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [author] = await adminClient.createUsers(team.id, 1, 'date-filter-author');
    const channel = await adminClient.createPublicChannel(team.id, 'Date Filter');
    const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');
    await adminClient.addToChannel(user.id, channel.id);
    await adminClient.addToChannel(author.id, channel.id);
    await adminClient.addToChannel(author.id, offTopic.id);
    await adminClient.updateUserRoles(author.id, 'system_user system_admin');
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
    });

    const identifier = pw.random.id();
    const inChannelMessage = `Date filter in channel ${identifier}`;
    const fromAuthorMessage = `Date filter from author ${identifier}`;
    const targetDate = Date.UTC(2018, 9, 15, 13, 15);
    const {client: authorClient} = await pw.makeClient(author);

    // # Create matching posts on the same date in two channels from two users
    await adminClient.createPost({
        channel_id: channel.id,
        message: inChannelMessage,
        create_at: targetDate,
    });
    await authorClient.createPost({
        channel_id: offTopic.id,
        message: fromAuthorMessage,
        create_at: targetDate + 10 * 60 * 1000,
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // * Verify on: plus in: returns only the post from the selected channel
    await searchAndExpect(channelsPage, `on:2018-10-15 in:${channel.name} ${identifier}`, [inChannelMessage]);

    // * Verify on: plus from: returns only the selected author's post
    await searchAndExpect(channelsPage, `on:2018-10-15 from:${author.username} ${identifier}`, [fromAuthorMessage]);

    // * Verify adding in: excludes that author's post from the other channel
    await searchAndExpect(channelsPage, `on:2018-10-15 in:${channel.name} from:${author.username} ${identifier}`, []);
});
