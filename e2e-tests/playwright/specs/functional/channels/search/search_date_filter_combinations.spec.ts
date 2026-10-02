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
