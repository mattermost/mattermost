// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {postAndFindMessage} from './search_helpers';

/**
 * @objective Verify a message posted while Elasticsearch/OpenSearch indexing and searching are
 * disabled can still be found through the search API, confirming the server falls back to
 * database search.
 *
 * @precondition
 * None beyond a running server — this is the default search mode.
 */
test('finds a newly posted message through database search', async ({pw}) => {
    // Ensure prerequisites
    await pw.ensurePostgresSearch();

    const {userClient, team} = await pw.initSetup();

    await postAndFindMessage(pw, userClient, team.id);
});
