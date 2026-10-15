// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

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

/**
 * Creates a user on two teams with a mention in a channel on each, plus one in the first team's
 * town-square, so a filter that spans teams has something to pick from either side.
 */
async function setupMentionsOnTwoTeams(pw: PlaywrightExtended) {
    const {adminClient, team, user} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');

    const secondTeam = await adminClient.createTeam(await pw.random.team('team', 'Team', 'O', true));
    await adminClient.addUsersToTeam(secondTeam.id, [user.id, mentioningUser.id]);

    const firstTeamChannel = await adminClient.createPublicChannel(team.id, 'First Team Mentions');
    const secondTeamChannel = await adminClient.createPublicChannel(secondTeam.id, 'Second Team Mentions');
    for (const channel of [firstTeamChannel, secondTeamChannel]) {
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.addToChannel(mentioningUser.id, channel.id);
    }

    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');

    const townSquareMention = `@${user.username} townsquare${pw.random.id()}`;
    const firstTeamMention = `@${user.username} firstteam${pw.random.id()}`;
    const secondTeamMention = `@${user.username} secondteam${pw.random.id()}`;

    for (const [channelId, message] of [
        [townSquare.id, townSquareMention],
        [firstTeamChannel.id, firstTeamMention],
        [secondTeamChannel.id, secondTeamMention],
    ] as const) {
        await adminClient.createPost({channel_id: channelId, user_id: mentioningUser.id, message});
    }

    return {
        team,
        secondTeam,
        user,
        firstTeamChannel,
        secondTeamChannel,
        townSquareMention,
        firstTeamMention,
        secondTeamMention,
    };
}

/** Opens Recent Mentions on a freshly logged in page. */
async function openRecentMentions(pw: PlaywrightExtended, user: UserProfile, teamName: string) {
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(teamName);
    await channelsPage.toBeVisible();
    await page.getByRole('button', {name: 'Recent mentions'}).click();
    await channelsPage.searchResultsPanel.toBeVisible();

    return {channelsPage, page};
}

/**
 * @objective Verify the date filter narrows recent mentions by when they arrived, separating Today
 * from the wider Last 7 days.
 */
test('the date filter narrows mentions by when they arrived', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');

    const day = 24 * 60 * 60 * 1000;
    const todayMention = `@${user.username} today${pw.random.id()}`;
    const threeDaysMention = `@${user.username} threedays${pw.random.id()}`;
    const tenDaysMention = `@${user.username} tendays${pw.random.id()}`;

    // # Backdate two of the mentions. Only an admin session may set create_at on a post.
    for (const [message, createAt] of [
        [todayMention, 0],
        [threeDaysMention, Date.now() - 3 * day],
        [tenDaysMention, Date.now() - 10 * day],
    ] as const) {
        await adminClient.createPost({
            channel_id: townSquare.id,
            user_id: mentioningUser.id,
            message,
            ...(createAt ? {create_at: createAt} : {}),
        });
    }

    const {channelsPage, page} = await openRecentMentions(pw, user, team.name);

    // * Verify all three are listed before any filter is applied
    await expect(channelsPage.searchResultsPanel.getResultByText(todayMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(threeDaysMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(tenDaysMention)).toHaveCount(1);

    // # Narrow to today
    await page.locator('#mentionFiltersButton').click();
    await page.locator('label.MentionFilters__choice', {hasText: 'Today'}).click();
    await page.getByRole('button', {name: 'Done'}).click();

    // * Verify only today's mention survives, with a chip naming the range
    await expect(page.getByTestId('mentionFilterChips')).toContainText('Today');
    await expect(channelsPage.searchResultsPanel.getResultByText(todayMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(threeDaysMention)).toHaveCount(0);
    await expect(channelsPage.searchResultsPanel.getResultByText(tenDaysMention)).toHaveCount(0);

    // # Widen to the last 7 days
    await page.locator('#mentionFiltersButton').click();
    await page.locator('label.MentionFilters__choice', {hasText: 'Last 7 days'}).click();
    await page.getByRole('button', {name: 'Done'}).click();

    // * Verify the range now reaches the three day old mention but still not the ten day old one
    await expect(page.getByTestId('mentionFilterChips')).toContainText('Last 7 days');
    await expect(channelsPage.searchResultsPanel.getResultByText(todayMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(threeDaysMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(tenDaysMention)).toHaveCount(0);
});

/**
 * @objective Verify removing the team chip takes the channel chips with it, since those channels
 * were picked from the team being dropped.
 */
test('removing the team chip clears the channel chips', {tag: '@search'}, async ({pw}) => {
    const {team, secondTeam, user, secondTeamChannel, townSquareMention, secondTeamMention} =
        await setupMentionsOnTwoTeams(pw);

    const {channelsPage, page} = await openRecentMentions(pw, user, team.name);

    // # Filter down to a channel on the second team
    await page.locator('#mentionFiltersButton').click();
    await page.locator('#mentionFiltersTeamSelector').click();
    await page.getByRole('menuitemradio', {name: secondTeam.display_name}).click();
    await page.locator('#mentionFiltersChannelSelector').click();
    await page
        .locator('.MentionFilters__channelPicker label', {hasText: secondTeamChannel.display_name})
        .first()
        .click();
    await page.getByRole('button', {name: 'Done'}).click();

    // * Verify both a team chip and a channel chip are showing
    await expect(page.getByTestId('mentionFilterChips').locator('.MentionFilterChip')).toHaveCount(2);

    // # Remove the team chip alone
    await page.getByRole('button', {name: `Remove ${secondTeam.display_name} filter`}).click();

    // * Verify the channel chip went with it and the results widened back out
    await expect(page.getByTestId('mentionFilterChips')).toHaveCount(0);
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(secondTeamMention)).toHaveCount(1);
});

/**
 * @objective Verify channels from two different teams can be filtered on together while the search
 * spans every team, which is the case channel names alone cannot express.
 */
test('filters by channels from two teams at once', {tag: '@search'}, async ({pw}) => {
    const {team, user, firstTeamChannel, secondTeamChannel, townSquareMention, firstTeamMention, secondTeamMention} =
        await setupMentionsOnTwoTeams(pw);

    const {channelsPage, page} = await openRecentMentions(pw, user, team.name);

    // # With the team left on all teams, pick one channel from each team
    await page.locator('#mentionFiltersButton').click();
    await page.locator('#mentionFiltersChannelSelector').click();
    for (const channel of [firstTeamChannel, secondTeamChannel]) {
        await page.locator('.MentionFilters__channelPicker label', {hasText: channel.display_name}).first().click();
    }
    await page.getByRole('button', {name: 'Done'}).click();

    // * Verify a chip per channel, each naming its team since the names span teams
    await expect(page.getByTestId('mentionFilterChips').locator('.MentionFilterChip')).toHaveCount(2);

    // * Verify both channels' mentions are kept and the unselected channel's is dropped
    await expect(channelsPage.searchResultsPanel.getResultByText(firstTeamMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(secondTeamMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(0);
});

/**
 * @objective Verify the count on the Filters button matches the chips being shown, and that Reset
 * clears every one of them.
 */
test('the filter count matches the chips, and Reset clears them', {tag: '@search'}, async ({pw}) => {
    const {team, secondTeam, user, secondTeamChannel, townSquareMention} = await setupMentionsOnTwoTeams(pw);

    const {channelsPage, page} = await openRecentMentions(pw, user, team.name);

    // # Apply one filter of every kind: team, channel, mention type and date
    await page.locator('#mentionFiltersButton').click();
    await page.locator('#mentionFiltersTeamSelector').click();
    await page.getByRole('menuitemradio', {name: secondTeam.display_name}).click();
    await page.locator('#mentionFiltersChannelSelector').click();
    await page
        .locator('.MentionFilters__channelPicker label', {hasText: secondTeamChannel.display_name})
        .first()
        .click();
    await page.locator('label.MentionFilters__choice', {hasText: 'Directly mentioning you'}).click();
    await page.locator('label.MentionFilters__choice', {hasText: 'Last 7 days'}).click();
    await page.getByRole('button', {name: 'Done'}).click();

    // * Verify the button counts exactly what the chip row shows
    await expect(page.locator('#mentionFiltersButton')).toHaveText('Filters (4)');
    await expect(page.getByTestId('mentionFilterChips').locator('.MentionFilterChip')).toHaveCount(4);

    // # Reset the popover and apply it
    await page.locator('#mentionFiltersButton').click();
    await page.getByRole('button', {name: 'Reset'}).click();
    await page.getByRole('button', {name: 'Done'}).click();

    // * Verify nothing is counted, no chips are left and every mention is back
    await expect(page.locator('#mentionFiltersButton')).toHaveText('Filters');
    await expect(page.getByTestId('mentionFilterChips')).toHaveCount(0);
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(1);
});

/**
 * @objective Verify the two controls that open Recent Mentions widen a filtered panel back out to
 * all mentions rather than closing it, so neither is a dead end once a filter is applied.
 */
test('the mentions button and its shortcut return to all mentions', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    const {channelsPage, page} = await openRecentMentions(pw, user, team.name);

    const applyChannelFilter = async () => {
        await page.locator('#mentionFiltersButton').click();
        await page.locator('#mentionFiltersChannelSelector').click();
        await page
            .locator('.MentionFilters__channelPicker label', {hasText: otherChannel.display_name})
            .first()
            .click();
        await page.getByRole('button', {name: 'Done'}).click();
        await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(0);
    };

    // # Filter to one channel, then press the Recent mentions button again
    await applyChannelFilter();
    await page.getByRole('button', {name: 'Recent mentions'}).click();

    // * Verify the panel stayed open and widened back out instead of closing
    await channelsPage.searchResultsPanel.toBeVisible();
    await expect(page.getByTestId('mentionFilterChips')).toHaveCount(0);
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(otherChannelMention)).toHaveCount(1);

    // # Filter again, then use the keyboard shortcut for the same button
    await applyChannelFilter();
    await page.keyboard.press('ControlOrMeta+Shift+M');

    // * Verify the shortcut widened the panel out rather than closing it
    await channelsPage.searchResultsPanel.toBeVisible();
    await expect(page.getByTestId('mentionFilterChips')).toHaveCount(0);
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(1);

    // * Verify the shortcut still closes the panel once nothing is filtered
    await page.keyboard.press('ControlOrMeta+Shift+M');
    await expect(channelsPage.searchResultsPanel.container).not.toBeVisible();
});

/**
 * @objective Verify popping out an unfiltered mentions panel keeps it unfiltered and spanning every
 * team. The popout only knows its URL, and being handed the current team would quietly narrow it.
 */
test('popping out an unfiltered mentions panel keeps every team', {tag: '@search'}, async ({pw}) => {
    const {team, user, townSquareMention, secondTeamMention} = await setupMentionsOnTwoTeams(pw);

    const {channelsPage, page} = await openRecentMentions(pw, user, team.name);

    // * Verify the panel spans both teams before it is popped out
    await expect(channelsPage.searchResultsPanel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(channelsPage.searchResultsPanel.getResultByText(secondTeamMention)).toHaveCount(1);

    // # Pop the panel out into its own window
    const popoutButton = page.locator('#searchContainer .PopoutButton');
    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), popoutButton.click()]);
    await popoutPage.waitForLoadState('domcontentloaded');

    // * Verify no filter travelled, since none was applied
    expect(popoutPage.url()).toContain('mode=mention');
    expect(popoutPage.url()).not.toContain('mentionChannels=');

    // * Verify the popped out window still spans both teams rather than the one it was opened from
    await expect(popoutPage.locator('#searchContainer').getByText(townSquareMention)).toBeVisible({timeout: 10000});
    await expect(popoutPage.locator('#searchContainer').getByText(secondTeamMention)).toBeVisible({timeout: 10000});
    await expect(popoutPage.getByTestId('mentionFilterChips')).toHaveCount(0);

    await popoutPage.close();
});

/**
 * @objective Verify a notification keyword shaped like a search modifier still finds its mentions.
 * Unquoted, `on:call` is read as a date filter rather than a word to match, which filters every
 * result away.
 */
test('a keyword shaped like a search modifier still finds mentions', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');

    // # Give the user a keyword that reads as a modifier
    await adminClient.patchUser({id: user.id, notify_props: {...user.notify_props, mention_keys: 'on:call'}});

    const keywordMention = `on:call rotation starts ${pw.random.id()}`;
    await adminClient.createPost({channel_id: townSquare.id, user_id: mentioningUser.id, message: keywordMention});

    const {channelsPage, page} = await openRecentMentions(pw, user, team.name);

    // * Verify the keyword mention is found rather than filtered away as a date
    await expect(channelsPage.searchResultsPanel.getResultByText(keywordMention)).toHaveCount(1);

    // # Keep only keyword mentions, so the query is the keyword alone with nothing else to carry it
    await page.locator('#mentionFiltersButton').click();
    await page.locator('label.MentionFilters__choice', {hasText: 'Keywords triggering mentions'}).click();
    await page.getByRole('button', {name: 'Done'}).click();

    // * Verify it survives on its own
    await expect(channelsPage.searchResultsPanel.getResultByText(keywordMention)).toHaveCount(1);
});
