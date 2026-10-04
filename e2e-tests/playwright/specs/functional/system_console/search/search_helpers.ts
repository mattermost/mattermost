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
 */
export async function postAndFindMessage(pw: PlaywrightExtended, userClient: Client4, teamId: string): Promise<void> {
    const townSquare = await userClient.getChannelByName(teamId, 'town-square');
    const uniqueTerm = `searchterm${getRandomId()}`;
    await userClient.createPost({channel_id: townSquare.id, message: `hello ${uniqueTerm}`});

    // Reuse the exact results snapshot that satisfied the poll below instead of re-querying
    // afterward: a second independent search call can race the search backend's own eventual
    // consistency (e.g. Elasticsearch's near-real-time refresh) and transiently see zero results
    // even though the immediately preceding poll attempt just found the post.
    let results: PostSearchResults | undefined;
    await pw.waitUntil(
        async () => {
            results = await userClient.searchPosts(teamId, uniqueTerm, false);
            return results.order.length > 0;
        },
        {timeout: 15000, intervalBetweenAttempts: 1000},
    );

    expect(results!.order).toHaveLength(1);
    expect(results!.posts[results!.order[0]].message).toContain(uniqueTerm);
}
