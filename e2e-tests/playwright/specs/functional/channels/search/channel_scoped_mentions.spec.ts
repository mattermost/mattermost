// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type PlaywrightExtended} from '@mattermost/playwright-lib';

/**
 * Creates a user who is mentioned once in town-square and once in a second channel, so that a
 * channel-scoped mention search has something to exclude and an all-channels search has two hits.
 */
async function setupMentionsInTwoChannels(pw: PlaywrightExtended) {
    const {adminClient, team, user} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');

    const otherChannel = await adminClient.createPublicChannel(team.id, 'Scoped Mentions');
    await adminClient.addToChannel(user.id, otherChannel.id);
    await adminClient.addToChannel(mentioningUser.id, otherChannel.id);

    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');

    // Each mention carries a unique token so a result can be attributed to one channel.
    const townSquareMention = `@${user.username} townsquare${pw.random.id()}`;
    const otherChannelMention = `@${user.username} otherchannel${pw.random.id()}`;

    await adminClient.createPost({
        channel_id: townSquare.id,
        user_id: mentioningUser.id,
        message: townSquareMention,
    });
    await adminClient.createPost({
        channel_id: otherChannel.id,
        user_id: mentioningUser.id,
        message: otherChannelMention,
    });

    return {team, user, otherChannel, townSquareMention, otherChannelMention};
}

/**
 * @objective Verify the "Recent Mentions in this Channel" channel-menu item filters recent mentions
 * down to the current channel, excluding mentions of the same user in other channels.
 */
test('channel menu scopes recent mentions to the current channel', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    // # Log in as the mentioned user and open the channel holding one of the two mentions
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, otherChannel.name);
    await channelsPage.toBeVisible();

    // # Open the channel header menu and choose "Recent Mentions in this Channel"
    await channelsPage.centerView.header.openChannelMenu();
    await page.getByRole('menuitem', {name: 'Recent Mentions in this Channel'}).click();

    // * Verify only the mention from this channel is listed
    await channelsPage.searchResultsPanel.toBeVisible();
    await expect(channelsPage.searchResultsPanel.getResultByText(otherChannelMention)).toHaveCount(1);

    // * Verify the mention from the other channel is excluded
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(0);
});

/**
 * @objective Verify the global Recent Mentions button still returns mentions from every channel,
 * so that scoping a mention search to one channel does not leak into the unscoped search.
 */
test('global recent mentions still returns mentions from every channel', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    // # Log in as the mentioned user and open the channel holding one of the two mentions
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, otherChannel.name);
    await channelsPage.toBeVisible();

    // # Scope mentions to the current channel first, so the unscoped search has state to clear
    await channelsPage.centerView.header.openChannelMenu();
    await page.getByRole('menuitem', {name: 'Recent Mentions in this Channel'}).click();
    await channelsPage.searchResultsPanel.toBeVisible();
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(0);

    // # Open the global Recent Mentions view
    await page.getByRole('button', {name: 'Recent mentions'}).click();

    // * Verify mentions from both channels are listed
    await channelsPage.searchResultsPanel.toBeVisible();
    await expect(channelsPage.searchResultsPanel.getResultByText(otherChannelMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(1);
});
