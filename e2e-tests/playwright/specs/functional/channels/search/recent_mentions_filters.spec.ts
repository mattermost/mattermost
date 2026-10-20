// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {ChannelsPage, expect, test, type PlaywrightExtended} from '@mattermost/playwright-lib';

/** Opens Recent Mentions on a freshly logged in page. */
async function openRecentMentions(pw: PlaywrightExtended, user: UserProfile, teamName: string) {
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(teamName);
    await channelsPage.toBeVisible();
    await channelsPage.globalHeader.openRecentMentions();

    const panel = channelsPage.searchResultsPanel;
    await panel.toBeVisible();

    return {channelsPage, page, panel, filters: panel.mentionFilters};
}

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
    const {panel, filters} = await openRecentMentions(pw, user, team.name);

    // * Verify both mentions are listed before any filter is applied
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(panel.getResultByText(otherChannelMention)).toHaveCount(1);

    // # Filter down to one of the two channels
    await filters.open();
    await filters.selectChannel(otherChannel.display_name);
    await filters.done();

    // * Verify only the mention from the selected channel remains
    await expect(panel.getResultItems()).toHaveCount(1);
    await expect(panel.getResultByText(otherChannelMention)).toHaveCount(1);
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(0);

    // * Verify a chip names the channel being filtered on
    await expect(filters.chips).toContainText(otherChannel.display_name);
});

/**
 * @objective Verify removing a filter chip widens the results back out, so that the chips are a
 * working control rather than a label.
 */
test('removing a filter chip restores the excluded mentions', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    // # Log in, open Recent Mentions and filter down to one channel
    const {panel, filters} = await openRecentMentions(pw, user, team.name);

    await filters.open();
    await filters.selectChannel(otherChannel.display_name);
    await filters.done();
    await expect(panel.getResultItems()).toHaveCount(1);
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(0);

    // # Remove the channel chip. The team selector is left on all teams, so the chip names the
    // channel's team alongside it and the accessible name is wider than the channel name alone.
    await filters.removeChip(otherChannel.display_name);

    // * Verify both mentions are listed again
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(panel.getResultByText(otherChannelMention)).toHaveCount(1);

    // * Verify the chip row is gone once nothing is filtered
    await expect(filters.chips).toHaveCount(0);
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
    const {panel, filters} = await openRecentMentions(pw, user, team.name);

    // * Verify both kinds of mention are listed before any filter is applied
    await expect(panel.getResultByText(directMention)).toHaveCount(1);
    await expect(panel.getResultByText(keywordMention)).toHaveCount(1);

    // # Keep only direct mentions
    await filters.open();
    await filters.selectMentionType('Directly mentioning you');
    await filters.done();

    // * Verify the keyword mention is excluded
    await expect(panel.getResultItems()).toHaveCount(1);
    await expect(panel.getResultByText(directMention)).toHaveCount(1);
    await expect(panel.getResultByText(keywordMention)).toHaveCount(0);
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
    const {panel, filters} = await openRecentMentions(pw, user, team.name);

    // * Verify mentions from both teams are listed before any filter is applied
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(panel.getResultByText(secondTeamMention)).toHaveCount(1);

    // # Pick the second team and one of its channels without closing the popover in between
    await filters.open();
    await filters.selectTeam(secondTeam.display_name);
    await filters.selectChannel(secondTeamChannel.display_name);
    await filters.done();

    // * Verify the channel filter survived being applied alongside the team change
    await expect(filters.chips).toContainText(secondTeamChannel.display_name);
    await expect(panel.getResultItems()).toHaveCount(1);
    await expect(panel.getResultByText(secondTeamMention)).toHaveCount(1);
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(0);
});

/**
 * @objective Verify popping out a filtered Recent Mentions panel opens a window showing the same
 * filtered view. The popout starts from an empty store, so the filters have to travel in its URL.
 */
test('popping out a filtered mentions panel keeps the filters', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    // # Log in, open Recent Mentions and filter down to one channel
    const {page, panel, filters} = await openRecentMentions(pw, user, team.name);

    await filters.open();
    await filters.selectChannel(otherChannel.display_name);
    await filters.done();
    await expect(panel.getResultItems()).toHaveCount(1);
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(0);

    // # Pop the panel out into its own window
    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), panel.getPopoutButton().click()]);
    await popoutPage.waitForLoadState('domcontentloaded');
    const popoutPanel = new ChannelsPage(popoutPage).searchResultsPanel;

    // * Verify the filter travelled in the URL rather than being dropped
    expect(popoutPage.url()).toContain('mode=mention');
    expect(popoutPage.url()).toContain(`mentionChannels=${otherChannel.id}`);

    // * Verify the popped out window shows the same filtered results, with the chip still on it
    await expect(popoutPanel.mentionFilters.chips).toContainText(otherChannel.display_name, {
        timeout: 10000,
    });
    await expect(popoutPanel.getResultItems()).toHaveCount(1, {timeout: 10000});
    await expect(popoutPanel.getResultByText(otherChannelMention)).toBeVisible({timeout: 10000});
    await expect(popoutPanel.getResultByText(townSquareMention)).toHaveCount(0);

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

    const {panel, filters} = await openRecentMentions(pw, user, team.name);

    // * Verify all three are listed before any filter is applied
    await expect(panel.getResultByText(todayMention)).toHaveCount(1);
    await expect(panel.getResultByText(threeDaysMention)).toHaveCount(1);
    await expect(panel.getResultByText(tenDaysMention)).toHaveCount(1);

    // # Narrow to today
    await filters.open();
    await filters.selectDate('Today');
    await filters.done();

    // * Verify only today's mention survives, with a chip naming the range
    await expect(filters.chips).toContainText('Today');
    await expect(panel.getResultItems()).toHaveCount(1);
    await expect(panel.getResultByText(todayMention)).toHaveCount(1);
    await expect(panel.getResultByText(threeDaysMention)).toHaveCount(0);
    await expect(panel.getResultByText(tenDaysMention)).toHaveCount(0);

    // # Widen to the last 7 days
    await filters.open();
    await filters.selectDate('Last 7 days');
    await filters.done();

    // * Verify the range now reaches the three day old mention but still not the ten day old one
    await expect(filters.chips).toContainText('Last 7 days');
    await expect(panel.getResultItems()).toHaveCount(2);
    await expect(panel.getResultByText(todayMention)).toHaveCount(1);
    await expect(panel.getResultByText(threeDaysMention)).toHaveCount(1);
    await expect(panel.getResultByText(tenDaysMention)).toHaveCount(0);
});

/**
 * @objective Verify removing the team chip takes the channel chips with it, since those channels
 * were picked from the team being dropped.
 */
test('removing the team chip clears the channel chips', {tag: '@search'}, async ({pw}) => {
    const {team, secondTeam, user, secondTeamChannel, townSquareMention, secondTeamMention} =
        await setupMentionsOnTwoTeams(pw);

    const {panel, filters} = await openRecentMentions(pw, user, team.name);

    // # Filter down to a channel on the second team
    await filters.open();
    await filters.selectTeam(secondTeam.display_name);
    await filters.selectChannel(secondTeamChannel.display_name);
    await filters.done();

    // * Verify both a team chip and a channel chip are showing
    await expect(filters.getChipRemoveButtons()).toHaveCount(2);

    // # Remove the team chip alone
    await filters.removeChip(secondTeam.display_name);

    // * Verify the channel chip went with it and the results widened back out
    await expect(filters.chips).toHaveCount(0);
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(panel.getResultByText(secondTeamMention)).toHaveCount(1);
});

/**
 * @objective Verify channels from two different teams can be filtered on together while the search
 * spans every team, which is the case channel names alone cannot express.
 */
test('filters by channels from two teams at once', {tag: '@search'}, async ({pw}) => {
    const {team, user, firstTeamChannel, secondTeamChannel, townSquareMention, firstTeamMention, secondTeamMention} =
        await setupMentionsOnTwoTeams(pw);

    const {panel, filters} = await openRecentMentions(pw, user, team.name);

    // # With the team left on all teams, pick one channel from each team
    await filters.open();
    for (const channel of [firstTeamChannel, secondTeamChannel]) {
        await filters.selectChannel(channel.display_name);
    }
    await filters.done();

    // * Verify a chip per channel, each naming its team since the names span teams
    await expect(filters.getChipRemoveButtons()).toHaveCount(2);

    // * Verify both channels' mentions are kept and the unselected channel's is dropped
    await expect(panel.getResultItems()).toHaveCount(2);
    await expect(panel.getResultByText(firstTeamMention)).toHaveCount(1);
    await expect(panel.getResultByText(secondTeamMention)).toHaveCount(1);
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(0);
});

/**
 * @objective Verify the count on the Filters button matches the chips being shown, and that Reset
 * clears every one of them.
 */
test('the filter count matches the chips, and Reset clears them', {tag: '@search'}, async ({pw}) => {
    const {team, secondTeam, user, secondTeamChannel, townSquareMention} = await setupMentionsOnTwoTeams(pw);

    const {panel, filters} = await openRecentMentions(pw, user, team.name);

    // # Apply one filter of every kind: team, channel, mention type and date
    await filters.open();
    await filters.selectTeam(secondTeam.display_name);
    await filters.selectChannel(secondTeamChannel.display_name);
    await filters.selectMentionType('Directly mentioning you');
    await filters.selectDate('Last 7 days');
    await filters.done();

    // * Verify the button counts exactly what the chip row shows
    await expect(filters.button).toHaveText('Filters (4)');
    await expect(filters.getChipRemoveButtons()).toHaveCount(4);

    // # Reset the popover and apply it
    await filters.open();
    await filters.reset();
    await filters.done();

    // * Verify nothing is counted, no chips are left and every mention is back
    await expect(filters.button).toHaveText('Filters');
    await expect(filters.chips).toHaveCount(0);
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(1);
});

/**
 * @objective Verify removing every chip one at a time brings the panel back to all mentions, with
 * the count on the Filters button dropping as each one goes.
 */
test('removing every chip one at a time clears the filters', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    const {panel, filters} = await openRecentMentions(pw, user, team.name);

    // # Apply a channel, a mention type and a date filter
    await filters.open();
    await filters.selectChannel(otherChannel.display_name);
    await filters.selectMentionType('Directly mentioning you');
    await filters.selectDate('Last 7 days');
    await filters.done();

    await expect(filters.button).toHaveText('Filters (3)');
    await expect(panel.getResultItems()).toHaveCount(1);

    // # Remove the chips one by one
    await filters.removeChip(otherChannel.display_name);
    await expect(filters.button).toHaveText('Filters (2)');
    await expect(filters.getChipRemoveButtons()).toHaveCount(2);

    await filters.removeChip('Directly mentioning you');
    await expect(filters.button).toHaveText('Filters (1)');
    await expect(filters.getChipRemoveButtons()).toHaveCount(1);

    await filters.removeChip('Last 7 days');

    // * Verify nothing is counted, the chip row is gone and both mentions are back
    await expect(filters.button).toHaveText('Filters');
    await expect(filters.chips).toHaveCount(0);
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(panel.getResultByText(otherChannelMention)).toHaveCount(1);
});

/**
 * @objective Verify the two controls that open Recent Mentions widen a filtered panel back out to
 * all mentions rather than closing it, so neither is a dead end once a filter is applied.
 */
test('the mentions button and its shortcut return to all mentions', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    const {channelsPage, page, panel, filters} = await openRecentMentions(pw, user, team.name);

    const applyChannelFilter = async () => {
        await filters.open();
        await filters.selectChannel(otherChannel.display_name);
        await filters.done();
        await expect(panel.getResultItems()).toHaveCount(1);
        await expect(panel.getResultByText(townSquareMention)).toHaveCount(0);
    };

    // # Filter to one channel, then press the Recent mentions button again
    await applyChannelFilter();
    await channelsPage.globalHeader.openRecentMentions();

    // * Verify the panel stayed open and widened back out instead of closing
    await panel.toBeVisible();
    await expect(filters.chips).toHaveCount(0);
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(panel.getResultByText(otherChannelMention)).toHaveCount(1);

    // # Filter again, then use the keyboard shortcut for the same button
    await applyChannelFilter();
    await page.keyboard.press('ControlOrMeta+Shift+M');

    // * Verify the shortcut widened the panel out rather than closing it
    await panel.toBeVisible();
    await expect(filters.chips).toHaveCount(0);
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(1);

    // * Verify the shortcut still closes the panel once nothing is filtered
    await page.keyboard.press('ControlOrMeta+Shift+M');
    await expect(panel.container).not.toBeVisible();
});

/**
 * @objective Verify popping out an unfiltered mentions panel keeps it unfiltered and spanning every
 * team. The popout only knows its URL, and being handed the current team would quietly narrow it.
 */
test('popping out an unfiltered mentions panel keeps every team', {tag: '@search'}, async ({pw}) => {
    const {team, user, townSquareMention, secondTeamMention} = await setupMentionsOnTwoTeams(pw);

    const {page, panel} = await openRecentMentions(pw, user, team.name);

    // * Verify the panel spans both teams before it is popped out
    await expect(panel.getResultByText(townSquareMention)).toHaveCount(1);
    await expect(panel.getResultByText(secondTeamMention)).toHaveCount(1);

    // # Pop the panel out into its own window
    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), panel.getPopoutButton().click()]);
    await popoutPage.waitForLoadState('domcontentloaded');
    const popoutPanel = new ChannelsPage(popoutPage).searchResultsPanel;

    // * Verify no filter travelled, since none was applied
    expect(popoutPage.url()).toContain('mode=mention');
    expect(popoutPage.url()).not.toContain('mentionChannels=');

    // * Verify the popped out window still spans both teams rather than the one it was opened from
    await expect(popoutPanel.getResultByText(townSquareMention)).toBeVisible({timeout: 10000});
    await expect(popoutPanel.getResultByText(secondTeamMention)).toBeVisible({timeout: 10000});
    await expect(popoutPanel.mentionFilters.chips).toHaveCount(0);

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

    const {panel, filters} = await openRecentMentions(pw, user, team.name);

    // * Verify the keyword mention is found rather than filtered away as a date
    await expect(panel.getResultByText(keywordMention)).toHaveCount(1);

    // # Keep only keyword mentions, so the query is the keyword alone with nothing else to carry it
    await filters.open();
    await filters.selectMentionType('Keywords triggering mentions');
    await filters.done();

    // * Verify it survives on its own
    await expect(panel.getResultByText(keywordMention)).toHaveCount(1);
});
