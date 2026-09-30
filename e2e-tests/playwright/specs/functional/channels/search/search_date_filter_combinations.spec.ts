// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {searchAndValidate, searchFilterDates, setupSearchDateFilter} from './search_date_filter_helpers';

/**
 * @objective Verify on: returns posts created on the target date and omits posts from other dates.
 */
test('MM-T588 on: omits results before and after target date', {tag: '@search_date_filter'}, async ({pw}) => {
    const {channelsPage, commonText, messages} = await setupSearchDateFilter(pw);

    // # Search for matching posts on the second fixture date
    // * Verify only posts from the target date appear in reverse chronological order
    await searchAndValidate(channelsPage, `on:${searchFilterDates.second} ${commonText}`, [
        messages.secondOffTopic,
        messages.second,
    ]);
});

/**
 * @objective Verify before: and after: can constrain a search to the dates between them.
 */
test('MM-T589 before: and after: can be used together', {tag: '@search_date_filter'}, async ({pw}) => {
    const {channelsPage, commonText, messages} = await setupSearchDateFilter(pw);

    // # Search between the first and latest fixture dates
    // * Verify only posts strictly between the dates appear in reverse chronological order
    await searchAndValidate(
        channelsPage,
        `before:${searchFilterDates.latest} after:${searchFilterDates.first} ${commonText}`,
        [messages.secondOffTopic, messages.second],
    );
});

/**
 * @objective Verify after: can be combined with in: to limit results by date and channel.
 */
test('MM-T592_1 after: can be used in conjunction with in:', {tag: '@search_date_filter'}, async ({pw}) => {
    const {channelsPage, channel, commonText, messages} = await setupSearchDateFilter(pw);

    // # Search after the first fixture date in the test channel
    // * Verify only later posts from that channel appear
    await searchAndValidate(channelsPage, `after:${searchFilterDates.first} in:${channel.name} ${commonText}`, [
        messages.latest,
        messages.second,
    ]);
});

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
    await searchAndValidate(channelsPage, `on:2018-10-15 in:${channel.name} ${identifier}`, [inChannelMessage]);

    // * Verify on: plus from: returns only the selected author's post
    await searchAndValidate(channelsPage, `on:2018-10-15 from:${author.username} ${identifier}`, [fromAuthorMessage]);

    // * Verify adding in: excludes that author's post from the other channel
    await searchAndValidate(channelsPage, `on:2018-10-15 in:${channel.name} from:${author.username} ${identifier}`, []);
});
