// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {expect, Msg, test, App, type PlaywrightExtended} from '@mattermost/playwright-lib';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The Recent Mentions panel on the generated `app.search` objects: its Filters button, popover and chips, and the
 * result posts. The page is the main window or a popout.
 */
function recentMentions(app: App) {
    const filters = app.search.mentionFilters;
    const {popover, chips} = filters;

    return {
        panel: app.search.panel,
        results: app.search.results.postList,
        async resultCount(text: string) {
            const posts = app.search.results.postList;
            const messages = await Promise.all(
                (await posts.keys()).map((key) => posts.item(key).message.container.text()),
            );
            return messages.filter((message) => message.includes(text)).length;
        },
        async chipCount() {
            const keys = await Promise.all([
                chips.channelList.keys(),
                chips.teamList.keys(),
                chips.dateList.keys(),
                chips.mentionTypeList.keys(),
            ]);
            return keys.reduce((count, list) => count + list.length, 0);
        },
        chips,
        button: filters.triggerButton,
        popoutButton: app.search.header.popoutButton,

        async open() {
            await filters.triggerButton.click();
            await expect(filters.popover).toBeVisible();
        },

        popover,

        async selectTeam(team: Pick<Team, 'display_name'>) {
            await popover.teamCombobox.choose(team.display_name);
            await expect(popover.teamCombobox).not.toBeExpanded();
        },

        /**
         * Picks a channel in the channel picker, which closes its menu so it doesn't cover the rest of the popover.
         * A channel's option can carry its team name too, so its name is matched as a substring.
         */
        async selectChannel(channel: Pick<Channel, 'display_name'>) {
            const picker = popover.channelsCombobox;
            await popover.channelsCombobox.choose(new RegExp(escapeRegExp(channel.display_name)));
            await expect(picker).not.toBeExpanded();
        },

        async apply() {
            await popover.applyButton.click();
            await expect(filters.popover).not.toBeVisible();
        },
    };
}

/** Opens Recent Mentions on a freshly logged in page. */
async function openRecentMentions(pw: PlaywrightExtended, user: UserProfile, teamName: string) {
    const {page, app} = await pw.testBrowser.login(user);
    await app.teamPage.goto({team: teamName});
    await expect(app.center.composer).toBeVisible();
    await app.globalHeader.recentMentionsButton.click();

    const mentions = recentMentions(app);
    await expect(mentions.panel).toBeVisible();

    return {app, page, mentions};
}

/**
 * Creates a user who is mentioned once in town-square and once in a second channel, so that a
 * channel filter has something to exclude and an unfiltered search has two hits.
 */
async function setupMentionsInTwoChannels(pw: PlaywrightExtended) {
    const {adminClient, team, user, townSquare} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');

    const otherChannel = await adminClient.createPublicChannel(team.id, 'Filtered Mentions');
    await adminClient.addToChannel(user.id, otherChannel.id);
    await adminClient.addToChannel(mentioningUser.id, otherChannel.id);
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
    const {mentions} = await openRecentMentions(pw, user, team.name);

    // * Verify both mentions are listed before any filter is applied
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(otherChannelMention)).toBe(1);

    // # Filter down to one of the two channels
    await mentions.open();
    await mentions.selectChannel(otherChannel);
    await mentions.apply();

    // * Verify only the mention from the selected channel remains
    await expect(mentions.results).toHaveKeyCount(1);
    await expect.poll(() => mentions.resultCount(otherChannelMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(0);

    // * Verify a chip names the channel being filtered on
    await expect(mentions.chips).toContainText(otherChannel.display_name);
});

/**
 * @objective Verify removing a filter chip widens the results back out, so that the chips are a
 * working control rather than a label.
 */
test('removing a filter chip restores the excluded mentions', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    // # Log in, open Recent Mentions and filter down to one channel
    const {mentions} = await openRecentMentions(pw, user, team.name);

    await mentions.open();
    await mentions.selectChannel(otherChannel);
    await mentions.apply();
    await expect(mentions.results).toHaveKeyCount(1);
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(0);

    // # Remove the channel chip
    // A removable chip removes itself on Delete
    await (await mentions.chips.channelList.itemWith({text: otherChannel.display_name})).press('Delete');

    // * Verify both mentions are listed again
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(otherChannelMention)).toBe(1);

    // * Verify the chip row is gone once nothing is filtered
    await expect(mentions.chips).toHaveCount(0);
});

/**
 * @objective Verify the mention type filter separates a direct mention from a keyword mention, since
 * both arrive through the same search.
 */
test('mention type filter separates direct mentions from keyword mentions', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user, townSquare} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');
    // # Give the user a notification keyword, so keyword mentions have something to match
    const keyword = `kw${pw.random.id()}`;
    await adminClient.patchUser({id: user.id, notify_props: {...user.notify_props, mention_keys: keyword}});

    const directMention = `@${user.username} direct${pw.random.id()}`;
    const keywordMention = `${keyword} keywordonly${pw.random.id()}`;

    await adminClient.createPost({channel_id: townSquare.id, user_id: mentioningUser.id, message: directMention});
    await adminClient.createPost({channel_id: townSquare.id, user_id: mentioningUser.id, message: keywordMention});

    // # Log in and open Recent Mentions
    const {mentions} = await openRecentMentions(pw, user, team.name);

    // * Verify both kinds of mention are listed before any filter is applied
    await expect.poll(() => mentions.resultCount(directMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(keywordMention)).toBe(1);

    // # Keep only direct mentions
    await mentions.open();
    await mentions.popover.mentionType('direct').check();
    await expect(mentions.popover.mentionType('direct')).toBeChecked();
    await mentions.apply();

    // * Verify the keyword mention is excluded
    await expect(mentions.results).toHaveKeyCount(1);
    await expect.poll(() => mentions.resultCount(directMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(keywordMention)).toBe(0);
});

/**
 * @objective Verify a team and a channel picked in the same popover session are applied together,
 * since the popover clears the channel selection as the team changes and the apply has to keep the
 * channels picked after it.
 */
test('a team and its channels picked together are both applied', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user, townSquare} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');

    // # Put the user on a second team, so the popover offers the team selector
    const secondTeam = await adminClient.createTeam(await pw.random.team('team', 'Team', 'O', true));
    await adminClient.addUsersToTeam(secondTeam.id, [user.id, mentioningUser.id]);

    const secondTeamChannel = await adminClient.createPublicChannel(secondTeam.id, 'Second Team Mentions');
    await adminClient.addToChannel(user.id, secondTeamChannel.id);
    await adminClient.addToChannel(mentioningUser.id, secondTeamChannel.id);
    const townSquareMention = `@${user.username} townsquare${pw.random.id()}`;
    const secondTeamMention = `@${user.username} secondteam${pw.random.id()}`;

    await adminClient.createPost({channel_id: townSquare.id, user_id: mentioningUser.id, message: townSquareMention});
    await adminClient.createPost({
        channel_id: secondTeamChannel.id,
        user_id: mentioningUser.id,
        message: secondTeamMention,
    });

    // # Log in and open Recent Mentions
    const {mentions} = await openRecentMentions(pw, user, team.name);

    // * Verify mentions from both teams are listed before any filter is applied
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(secondTeamMention)).toBe(1);

    // # Pick the second team and one of its channels without closing the popover in between
    await mentions.open();
    await mentions.selectTeam(secondTeam);
    await mentions.selectChannel(secondTeamChannel);
    await mentions.apply();

    // * Verify the channel filter survived being applied alongside the team change
    await expect(mentions.chips).toContainText(secondTeamChannel.display_name);
    await expect(mentions.results).toHaveKeyCount(1);
    await expect.poll(() => mentions.resultCount(secondTeamMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(0);
});

/**
 * @objective Verify popping out a filtered Recent Mentions panel opens a window showing the same
 * filtered view. The popout starts from an empty store, so the filters have to travel in its URL.
 */
test('popping out a filtered mentions panel keeps the filters', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    // # Log in, open Recent Mentions and filter down to one channel
    const {page, mentions} = await openRecentMentions(pw, user, team.name);

    await mentions.open();
    await mentions.selectChannel(otherChannel);
    await mentions.apply();
    await expect(mentions.results).toHaveKeyCount(1);
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(0);

    // # Pop the panel out into its own window
    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), mentions.popoutButton.click()]);
    await popoutPage.waitForLoadState('domcontentloaded');
    const popoutMentions = recentMentions(new App(popoutPage));

    // * Verify the filter travelled in the URL rather than being dropped
    expect(popoutPage.url()).toContain('mode=mention');
    expect(popoutPage.url()).toContain(`mentionChannels=${otherChannel.id}`);

    // * Verify the popped out window shows the same filtered results, with the chip still on it
    await expect(popoutMentions.chips).toContainText(otherChannel.display_name);
    await expect(popoutMentions.results).toHaveKeyCount(1);
    await expect.poll(() => popoutMentions.resultCount(otherChannelMention)).toBeGreaterThan(0);
    await expect.poll(() => popoutMentions.resultCount(townSquareMention)).toBe(0);

    await popoutPage.close();
});

/**
 * Creates a user on two teams with a mention in a channel on each, plus one in the first team's
 * town-square, so a filter that spans teams has something to pick from either side.
 */
async function setupMentionsOnTwoTeams(pw: PlaywrightExtended) {
    const {adminClient, team, user, townSquare} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');

    const secondTeam = await adminClient.createTeam(await pw.random.team('team', 'Team', 'O', true));
    await adminClient.addUsersToTeam(secondTeam.id, [user.id, mentioningUser.id]);

    const firstTeamChannel = await adminClient.createPublicChannel(team.id, 'First Team Mentions');
    const secondTeamChannel = await adminClient.createPublicChannel(secondTeam.id, 'Second Team Mentions');
    for (const channel of [firstTeamChannel, secondTeamChannel]) {
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.addToChannel(mentioningUser.id, channel.id);
    }
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
    const {adminClient, team, user, townSquare} = await pw.initSetup();
    const day = 24 * 60 * 60 * 1000;
    const todayMention = `@${user.username} today${pw.random.id()}`;
    const threeDaysMention = `@${user.username} threedays${pw.random.id()}`;
    const tenDaysMention = `@${user.username} tendays${pw.random.id()}`;

    // # Backdate two of the mentions. Only an admin session may set create_at on a post, so the admin writes them.
    for (const [message, createAt] of [
        [todayMention, 0],
        [threeDaysMention, Date.now() - 3 * day],
        [tenDaysMention, Date.now() - 10 * day],
    ] as const) {
        await adminClient.createPost({
            channel_id: townSquare.id,
            message,
            ...(createAt ? {create_at: createAt} : {}),
        });
    }

    const {mentions} = await openRecentMentions(pw, user, team.name);

    // * Verify all three are listed before any filter is applied
    await expect.poll(() => mentions.resultCount(todayMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(threeDaysMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(tenDaysMention)).toBe(1);

    // # Narrow to today
    await mentions.open();
    await mentions.popover.date('today').check();
    await expect(mentions.popover.date('today')).toBeChecked();
    await mentions.apply();

    // * Verify only today's mention survives, with a chip naming the range
    await expect(mentions.chips).toContainText('Today');
    await expect(mentions.results).toHaveKeyCount(1);
    await expect.poll(() => mentions.resultCount(todayMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(threeDaysMention)).toBe(0);
    await expect.poll(() => mentions.resultCount(tenDaysMention)).toBe(0);

    // # Widen to the last 7 days
    await mentions.open();
    await mentions.popover.date('last_7_days').check();
    await expect(mentions.popover.date('last_7_days')).toBeChecked();
    await mentions.apply();

    // * Verify the range now reaches the three day old mention but still not the ten day old one
    await expect(mentions.chips).toContainText('Last 7 days');
    await expect(mentions.results).toHaveKeyCount(2);
    await expect.poll(() => mentions.resultCount(todayMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(threeDaysMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(tenDaysMention)).toBe(0);
});

/**
 * @objective Verify removing the team chip takes the channel chips with it, since those channels
 * were picked from the team being dropped.
 */
test('removing the team chip clears the channel chips', {tag: '@search'}, async ({pw}) => {
    const {team, secondTeam, user, secondTeamChannel, townSquareMention, secondTeamMention} =
        await setupMentionsOnTwoTeams(pw);

    const {mentions} = await openRecentMentions(pw, user, team.name);

    // # Filter down to a channel on the second team
    await mentions.open();
    await mentions.selectTeam(secondTeam);
    await mentions.selectChannel(secondTeamChannel);
    await mentions.apply();

    // * Verify both a team chip and a channel chip are showing
    await expect.poll(() => mentions.chipCount()).toBe(2);

    // # Remove the team chip alone
    // A removable chip removes itself on Delete
    await mentions.chips.team(secondTeam).press('Delete');

    // * Verify the channel chip went with it and the results widened back out
    await expect(mentions.chips).toHaveCount(0);
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(secondTeamMention)).toBe(1);
});

/**
 * @objective Verify channels from two different teams can be filtered on together while the search
 * spans every team, which is the case channel names alone cannot express.
 */
test('filters by channels from two teams at once', {tag: '@search'}, async ({pw}) => {
    const {team, user, firstTeamChannel, secondTeamChannel, townSquareMention, firstTeamMention, secondTeamMention} =
        await setupMentionsOnTwoTeams(pw);

    const {mentions} = await openRecentMentions(pw, user, team.name);

    // # With the team left on all teams, pick one channel from each team
    await mentions.open();
    for (const channel of [firstTeamChannel, secondTeamChannel]) {
        await mentions.selectChannel(channel);
    }
    await mentions.apply();

    // * Verify a chip per channel, each naming its team since the names span teams
    await expect.poll(() => mentions.chipCount()).toBe(2);

    // * Verify both channels' mentions are kept and the unselected channel's is dropped
    await expect(mentions.results).toHaveKeyCount(2);
    await expect.poll(() => mentions.resultCount(firstTeamMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(secondTeamMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(0);
});

/**
 * @objective Verify the count on the Filters button matches the chips being shown, and that Reset
 * clears every one of them.
 */
test('the filter count matches the chips, and Reset clears them', {tag: '@search'}, async ({pw}) => {
    const {team, secondTeam, user, secondTeamChannel, townSquareMention} = await setupMentionsOnTwoTeams(pw);

    const {mentions} = await openRecentMentions(pw, user, team.name);

    // # Apply one filter of every kind: team, channel, mention type and date
    await mentions.open();
    await mentions.selectTeam(secondTeam);
    await mentions.selectChannel(secondTeamChannel);
    await mentions.popover.mentionType('direct').check();
    await expect(mentions.popover.mentionType('direct')).toBeChecked();
    await mentions.popover.date('last_7_days').check();
    await expect(mentions.popover.date('last_7_days')).toBeChecked();
    await mentions.apply();

    // * Verify the button counts exactly what the chip row shows
    await expect(mentions.button).toHaveMessage(Msg.search_results.mention_filters.button_with_count, {count: 4});
    await expect.poll(() => mentions.chipCount()).toBe(4);

    // # Reset the popover and apply it
    await mentions.open();
    await mentions.popover.resetButton.click();
    await expect(mentions.popover.mentionType('direct')).not.toBeChecked();
    await mentions.apply();

    // * Verify nothing is counted, no chips are left and every mention is back
    await expect(mentions.button).toHaveMessage(Msg.search_results.mention_filters.button);
    await expect(mentions.chips).toHaveCount(0);
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(1);
});

/**
 * @objective Verify removing every chip one at a time brings the panel back to all mentions, with
 * the count on the Filters button dropping as each one goes.
 */
test('removing every chip one at a time clears the filters', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    const {mentions} = await openRecentMentions(pw, user, team.name);

    // # Apply a channel, a mention type and a date filter
    await mentions.open();
    await mentions.selectChannel(otherChannel);
    await mentions.popover.mentionType('direct').check();
    await expect(mentions.popover.mentionType('direct')).toBeChecked();
    await mentions.popover.date('last_7_days').check();
    await expect(mentions.popover.date('last_7_days')).toBeChecked();
    await mentions.apply();

    await expect(mentions.button).toHaveMessage(Msg.search_results.mention_filters.button_with_count, {count: 3});
    await expect(mentions.results).toHaveKeyCount(1);

    // # Remove the chips one by one
    // A removable chip removes itself on Delete
    await (await mentions.chips.channelList.itemWith({text: otherChannel.display_name})).press('Delete');
    await expect(mentions.button).toHaveMessage(Msg.search_results.mention_filters.button_with_count, {count: 2});
    await expect.poll(() => mentions.chipCount()).toBe(2);

    // A removable chip removes itself on Delete
    await mentions.chips.mentionType('direct').press('Delete');
    await expect(mentions.button).toHaveMessage(Msg.search_results.mention_filters.button_with_count, {count: 1});
    await expect.poll(() => mentions.chipCount()).toBe(1);

    // A removable chip removes itself on Delete
    await mentions.chips.date('last_7_days').press('Delete');

    // * Verify nothing is counted, the chip row is gone and both mentions are back
    await expect(mentions.button).toHaveMessage(Msg.search_results.mention_filters.button);
    await expect(mentions.chips).toHaveCount(0);
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(otherChannelMention)).toBe(1);
});

/**
 * @objective Verify the two controls that open Recent Mentions widen a filtered panel back out to
 * all mentions rather than closing it, so neither is a dead end once a filter is applied.
 */
test('the mentions button and its shortcut return to all mentions', {tag: '@search'}, async ({pw}) => {
    const {team, user, otherChannel, townSquareMention, otherChannelMention} = await setupMentionsInTwoChannels(pw);

    const {app, page, mentions} = await openRecentMentions(pw, user, team.name);

    const applyChannelFilter = async () => {
        await mentions.open();
        await mentions.selectChannel(otherChannel);
        await mentions.apply();
        await expect(mentions.results).toHaveKeyCount(1);
        await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(0);
    };

    // # Filter to one channel, then press the Recent mentions button again
    await applyChannelFilter();
    await app.globalHeader.recentMentionsButton.click();

    // * Verify the panel stayed open and widened back out instead of closing
    await expect(mentions.panel).toBeVisible();
    await expect(mentions.chips).toHaveCount(0);
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(otherChannelMention)).toBe(1);

    // # Filter again, then use the keyboard shortcut for the same button
    await applyChannelFilter();
    await page.keyboard.press('ControlOrMeta+Shift+M');

    // * Verify the shortcut widened the panel out rather than closing it
    await expect(mentions.panel).toBeVisible();
    await expect(mentions.chips).toHaveCount(0);
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(1);

    // * Verify the shortcut still closes the panel once nothing is filtered
    await page.keyboard.press('ControlOrMeta+Shift+M');
    await expect(mentions.panel).not.toBeVisible();
});

/**
 * @objective Verify popping out an unfiltered mentions panel keeps it unfiltered and spanning every
 * team. The popout only knows its URL, and being handed the current team would quietly narrow it.
 */
test('popping out an unfiltered mentions panel keeps every team', {tag: '@search'}, async ({pw}) => {
    const {team, user, townSquareMention, secondTeamMention} = await setupMentionsOnTwoTeams(pw);

    const {page, mentions} = await openRecentMentions(pw, user, team.name);

    // * Verify the panel spans both teams before it is popped out
    await expect.poll(() => mentions.resultCount(townSquareMention)).toBe(1);
    await expect.poll(() => mentions.resultCount(secondTeamMention)).toBe(1);

    // # Pop the panel out into its own window
    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), mentions.popoutButton.click()]);
    await popoutPage.waitForLoadState('domcontentloaded');
    const popoutMentions = recentMentions(new App(popoutPage));

    // * Verify no filter travelled, since none was applied
    expect(popoutPage.url()).toContain('mode=mention');
    expect(popoutPage.url()).not.toContain('mentionChannels=');

    // * Verify the popped out window still spans both teams rather than the one it was opened from
    await expect.poll(() => popoutMentions.resultCount(townSquareMention)).toBeGreaterThan(0);
    await expect.poll(() => popoutMentions.resultCount(secondTeamMention)).toBeGreaterThan(0);
    await expect(popoutMentions.chips).toHaveCount(0);

    await popoutPage.close();
});

/**
 * @objective Verify a notification keyword shaped like a search modifier still finds its mentions.
 * Unquoted, `on:call` is read as a date filter rather than a word to match, which filters every
 * result away.
 */
test('a keyword shaped like a search modifier still finds mentions', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user, townSquare} = await pw.initSetup();
    const [mentioningUser] = await adminClient.createUsers(team.id, 1, 'mentioner');
    // # Give the user a keyword that reads as a modifier
    await adminClient.patchUser({id: user.id, notify_props: {...user.notify_props, mention_keys: 'on:call'}});

    const keywordMention = `on:call rotation starts ${pw.random.id()}`;
    await adminClient.createPost({channel_id: townSquare.id, user_id: mentioningUser.id, message: keywordMention});

    const {mentions} = await openRecentMentions(pw, user, team.name);

    // * Verify the keyword mention is found rather than filtered away as a date
    await expect.poll(() => mentions.resultCount(keywordMention)).toBe(1);

    // # Keep only keyword mentions, so the query is the keyword alone with nothing else to carry it
    await mentions.open();
    await mentions.popover.mentionType('keyword').check();
    await expect(mentions.popover.mentionType('keyword')).toBeChecked();
    await mentions.apply();

    // * Verify it survives on its own
    await expect.poll(() => mentions.resultCount(keywordMention)).toBe(1);
});
