// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {postAndFindMessage} from './search_helpers';

/**
 * @objective Verify a message posted while OpenSearch indexing/searching is enabled can be found
 * through the search API, confirming the server is actually querying OpenSearch rather than
 * silently falling back to database search.
 *
 * @precondition
 * An OpenSearch cluster reachable at the configured ElasticsearchSettings.ConnectionURL, with
 * Backend set to "opensearch", and a server license that includes Elasticsearch.
 */
test('finds a newly posted message through OpenSearch search', {tag: '@opensearch'}, async ({pw}) => {
    // Ensure prerequisites
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureOpensearch();

    const {adminClient, userClient, team} = await pw.initSetup();
    await adminClient.purgeElasticsearchIndexes();

    // # Post a message with a unique term, then search for it via the search API
    // * Verify the search API returns exactly the post containing the unique term
    await postAndFindMessage(pw, userClient, team.id);
});
