// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PostSearchResults} from '@mattermost/types/posts';

import {expect, getRandomId} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

/**
 * Posts a message with a unique term, polls the search API until it's indexed, then asserts it's
 * the single result returned — the common flow across the Elasticsearch/OpenSearch/database search
 * specs, which otherwise differ only in prerequisite setup (ensure*, plus index purge).
 *
 * The server silently answers from the database whenever the search engine errors (e.g. while a
 * just-purged index has no mappings yet). Only engine answers carry `matches` (highlights), so with
 * `fromSearchEngine` the poll waits for one and the assertions run on that same response.
 */
export async function postAndFindMessage(
    pw: PlaywrightExtended,
    userClient: Client4,
    teamId: string,
    {fromSearchEngine = false}: {fromSearchEngine?: boolean} = {},
): Promise<void> {
    const townSquare = await userClient.getChannelByName(teamId, 'town-square');
    const uniqueTerm = `searchterm${getRandomId()}`;
    await userClient.createPost({channel_id: townSquare.id, message: `hello ${uniqueTerm}`});

    let results: PostSearchResults | undefined;
    await pw.waitUntil(
        async () => {
            results = await userClient.searchPosts(teamId, uniqueTerm, false);
            const found = results.order.length > 0;
            return fromSearchEngine ? found && Boolean(results.matches?.[results.order[0]]) : found;
        },
        {timeout: 15000, intervalBetweenAttempts: 1000},
    );

    const {order, posts} = results!;
    expect(order).toHaveLength(1);
    expect(posts[order[0]].message).toContain(uniqueTerm);
}
