// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {searchAndValidate, searchFilterDates, setupSearchDateFilter} from './search_date_filter_helpers';

/**
 * @objective Verify after: can be combined with from: to limit results by date and author.
 */
test('MM-T592_2 after: can be used in conjunction with from:', {tag: '@search_date_filter'}, async ({pw}) => {
    const {channelsPage, anotherAdmin, commonText, messages} = await setupSearchDateFilter(pw);

    // # Search after the first fixture date for posts by the second author
    // * Verify only the later post by that author appears
    await searchAndValidate(
        channelsPage,
        `after:${searchFilterDates.first} from:${anotherAdmin.username} ${commonText}`,
        [messages.secondOffTopic],
    );
});

/**
 * @objective Verify re-adding in: to an after: and from: query applies all terms and returns no partial matches.
 */
test('MM-T592_3 after: re-add in: in conjunction with from:', {tag: '@search_date_filter'}, async ({pw}) => {
    const {channelsPage, channel, anotherAdmin, commonText} = await setupSearchDateFilter(pw);
    const query = `after:${searchFilterDates.first} in:${channel.name} ${commonText} from:${anotherAdmin.username} ${commonText}`;

    // # Search with after:, in:, from:, and the repeated common term
    // * Verify the exact no-results message appears
    await searchAndValidate(channelsPage, query);
});

/**
 * @objective Verify before:, after:, from:, and in: can be combined in one search.
 */
test(
    'MM-T593 before:, after:, from:, and in: can be used in one search',
    {tag: '@search_date_filter'},
    async ({pw}) => {
        const {channelsPage, anotherAdmin, commonText, messages} = await setupSearchDateFilter(pw);

        // # Search between two dates in off-topic for posts by the second author
        // * Verify only the matching post appears
        await searchAndValidate(
            channelsPage,
            `before:${searchFilterDates.latest} after:${searchFilterDates.first} from:${anotherAdmin.username} in:off-topic ${commonText}`,
            [messages.secondOffTopic],
        );
    },
);
