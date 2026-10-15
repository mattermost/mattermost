// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type PlaywrightExtended} from '@mattermost/playwright-lib';

/**
 * Creates a user who is mentioned once in town-square and once in a second channel, so that a
 * channel filter has something to exclude and an unfiltered search has two hits.
 */
async function setupMentionsInTwoChannels(pw: PlaywrightExtended) {
    const {adminClient, team, user} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');

    const otherChannel = await adminClient.createPublicChannel(team.id, 'Filtered Mentions');
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
 * @objective Verify the channel filter in the Recent Mentions panel narrows the results to the
 * selected channel, excluding mentions of the same user elsewhere.
 */
test('channel filter narrows recent mentions to the selected channel', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    // # Log in and open Recent Mentions
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();
    await page.getByRole('button', {name: 'Recent mentions'}).click();
    await channelsPage.searchResultsPanel.toBeVisible();

    // * Verify both mentions are listed before any filter is applied
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(otherChannelMention)).toHaveCount(1);

    // # Filter down to one of the two channels
    await page.locator('#mentionFiltersButton').click();
    await page.locator('#mentionFiltersChannelSelector').click();
    await page.locator('.MentionFilters__channelPicker label', {hasText: otherChannel.display_name}).first().click();
    await page.getByRole('button', {name: 'Done'}).click();

    // * Verify only the mention from the selected channel remains
    await expect(channelsPage.searchResultsPanel.getResultByText(otherChannelMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(0);

    // * Verify a chip names the channel being filtered on
    await expect(page.getByTestId('mentionFilterChips')).toContainText(otherChannel.display_name);
});

/**
 * @objective Verify removing a filter chip widens the results back out, so that the chips are a
 * working control rather than a label.
 */
test('removing a filter chip restores the excluded mentions', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    // # Log in, open Recent Mentions and filter down to one channel
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();
    await page.getByRole('button', {name: 'Recent mentions'}).click();
    await channelsPage.searchResultsPanel.toBeVisible();

    await page.locator('#mentionFiltersButton').click();
    await page.locator('#mentionFiltersChannelSelector').click();
    await page.locator('.MentionFilters__channelPicker label', {hasText: otherChannel.display_name}).first().click();
    await page.getByRole('button', {name: 'Done'}).click();
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(0);

    // # Remove the channel chip. The team selector is left on all teams, so the chip names the
    // channel's team alongside it and the accessible name is wider than the channel name alone.
    await page.getByRole('button', {name: `Remove ${otherChannel.display_name}`, exact: false}).click();

    // * Verify both mentions are listed again
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(otherChannelMention)).toHaveCount(1);

    // * Verify the chip row is gone once nothing is filtered
    await expect(page.getByTestId('mentionFilterChips')).toHaveCount(0);
});

/**
 * @objective Verify the mention type filter separates a direct mention from a keyword mention, since
 * both arrive through the same search.
 */
test('mention type filter separates direct mentions from keyword mentions', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');

    // # Give the user a notification keyword, so keyword mentions have something to match
    const keyword = `kw${pw.random.id()}`;
    await adminClient.patchUser({id: user.id, notify_props: {...user.notify_props, mention_keys: keyword}});

    const directMention = `@${user.username} direct${pw.random.id()}`;
    const keywordMention = `${keyword} keywordonly${pw.random.id()}`;

    await adminClient.createPost({channel_id: townSquare.id, user_id: mentioningUser.id, message: directMention});
    await adminClient.createPost({channel_id: townSquare.id, user_id: mentioningUser.id, message: keywordMention});

    // # Log in and open Recent Mentions
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();
    await page.getByRole('button', {name: 'Recent mentions'}).click();
    await channelsPage.searchResultsPanel.toBeVisible();

    // * Verify both kinds of mention are listed before any filter is applied
    await expect(channelsPage.searchResultsPanel.getResultByText(directMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(keywordMention)).toHaveCount(1);

    // # Keep only direct mentions
    await page.locator('#mentionFiltersButton').click();
    await page.locator('label.MentionFilters__choice', {hasText: 'Directly mentioning you'}).click();
    await page.getByRole('button', {name: 'Done'}).click();

    // * Verify the keyword mention is excluded
    await expect(channelsPage.searchResultsPanel.getResultByText(directMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(keywordMention)).toHaveCount(0);
});

/**
 * @objective Verify a team and a channel picked in the same popover session are applied together,
 * since the popover clears the channel selection as the team changes and the apply has to keep the
 * channels picked after it.
 */
test('a team and its channels picked together are both applied', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');

    // # Put the user on a second team, so the popover offers the team selector
    const secondTeam = await adminClient.createTeam(await pw.random.team('team', 'Team', 'O', true));
    await adminClient.addUsersToTeam(secondTeam.id, [user.id, mentioningUser.id]);

    const secondTeamChannel = await adminClient.createPublicChannel(secondTeam.id, 'Second Team Mentions');
    await adminClient.addToChannel(user.id, secondTeamChannel.id);
    await adminClient.addToChannel(mentioningUser.id, secondTeamChannel.id);

    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    const townSquareMention = `@${user.username} townsquare${pw.random.id()}`;
    const secondTeamMention = `@${user.username} secondteam${pw.random.id()}`;

    await adminClient.createPost({channel_id: townSquare.id, user_id: mentioningUser.id, message: townSquareMention});
    await adminClient.createPost({
        channel_id: secondTeamChannel.id,
        user_id: mentioningUser.id,
        message: secondTeamMention,
    });

    // # Log in and open Recent Mentions
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();
    await page.getByRole('button', {name: 'Recent mentions'}).click();
    await channelsPage.searchResultsPanel.toBeVisible();

    // * Verify mentions from both teams are listed before any filter is applied
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(secondTeamMention)).toHaveCount(1);

    // # Pick the second team and one of its channels without closing the popover in between
    await page.locator('#mentionFiltersButton').click();
    await page.locator('#mentionFiltersTeamSelector').click();
    await page.getByRole('menuitemradio', {name: secondTeam.display_name}).click();
    await page.locator('#mentionFiltersChannelSelector').click();
    await page
        .locator('.MentionFilters__channelPicker label', {hasText: secondTeamChannel.display_name})
        .first()
        .click();
    await page.getByRole('button', {name: 'Done'}).click();

    // * Verify the channel filter survived being applied alongside the team change
    await expect(page.getByTestId('mentionFilterChips')).toContainText(secondTeamChannel.display_name);
    await expect(channelsPage.searchResultsPanel.getResultByText(secondTeamMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(0);
});

/**
 * @objective Verify popping out a filtered Recent Mentions panel opens a window showing the same
 * filtered view. The popout starts from an empty store, so the filters have to travel in its URL.
 */
test('popping out a filtered mentions panel keeps the filters', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    // # Log in, open Recent Mentions and filter down to one channel
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();
    await page.getByRole('button', {name: 'Recent mentions'}).click();
    await channelsPage.searchResultsPanel.toBeVisible();

    await page.locator('#mentionFiltersButton').click();
    await page.locator('#mentionFiltersChannelSelector').click();
    await page.locator('.MentionFilters__channelPicker label', {hasText: otherChannel.display_name}).first().click();
    await page.getByRole('button', {name: 'Done'}).click();
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(0);

    // # Pop the panel out into its own window
    const popoutButton = page.locator('#searchContainer .PopoutButton');
    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), popoutButton.click()]);
    await popoutPage.waitForLoadState('domcontentloaded');

    // * Verify the filter travelled in the URL rather than being dropped
    expect(popoutPage.url()).toContain('mode=mention');
    expect(popoutPage.url()).toContain(`mentionChannels=${otherChannel.id}`);

    // * Verify the popped out window shows the same filtered results, with the chip still on it
    await expect(popoutPage.getByTestId('mentionFilterChips')).toContainText(otherChannel.display_name, {
        timeout: 10000,
    });
    await expect(popoutPage.locator('#searchContainer').getByText(otherChannelMention)).toBeVisible({timeout: 10000});
    await expect(popoutPage.locator('#searchContainer').getByText(townSquareMention)).toHaveCount(0);

    await popoutPage.close();
});
