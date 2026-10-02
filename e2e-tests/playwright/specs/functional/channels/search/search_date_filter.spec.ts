// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {searchAndValidate, searchFilterDates, setupSearchDateFilter} from './search_date_filter_helpers';

/**
 * @objective Verify an unfiltered search returns all matching posts in reverse chronological order.
 */
test('MM-T585_1 Unfiltered search for all posts is not affected', {tag: '@search_date_filter'}, async ({pw}) => {
    const {channelsPage, commonText, allMessagesInOrder} = await setupSearchDateFilter(pw);

    // # Search for the text shared by all five dated posts
    // * Verify every matching post appears in reverse chronological order
    await searchAndValidate(channelsPage, commonText, allMessagesInOrder);
});

/**
 * @objective Verify an unfiltered search for the most recent matching post returns only that post.
 */
test('MM-T585_2 Unfiltered search for recent post is not affected', {tag: '@search_date_filter'}, async ({pw}) => {
    const {channelsPage, messages} = await setupSearchDateFilter(pw);

    // # Search for the complete text of the most recent post
    // * Verify only the most recent post appears
    await searchAndValidate(channelsPage, messages.latest, [messages.latest]);
});

/**
 * @objective Verify after: excludes posts created before and on the target date.
 */
test('MM-T587 after: omits results before and on target date', {tag: '@search_date_filter'}, async ({pw}) => {
    const {channelsPage, commonText, messages} = await setupSearchDateFilter(pw);

    // # Search for matching posts after the first fixture date
    // * Verify only posts from later dates appear in reverse chronological order
    await searchAndValidate(channelsPage, `after:${searchFilterDates.first} ${commonText}`, [
        messages.latest,
        messages.secondOffTopic,
        messages.second,
    ]);
});
