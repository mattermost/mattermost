// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {getAdminClient} from './init';

/**
 * Disables Elasticsearch/OpenSearch indexing/searching so search falls back to the database —
 * skipping the test otherwise, instead of failing on an unmet precondition. The counterpart to
 * ensureElasticsearch()/ensureOpensearch() for specs that specifically need database-backed search
 * active (e.g. after another spec in the same run switched it away).
 *
 * No restart involved, unlike most other ensure*() functions: which search engine (if any) is
 * active is decided at runtime from these enable flags, not from the boot-time Backend setting, so
 * disabling them here is enough to make the server fall through to Postgres-backed search.
 */
export async function ensurePostgresSearch(): Promise<void> {
    try {
        const {adminClient} = await getAdminClient();
        await adminClient.patchConfig({
            ElasticsearchSettings: {EnableIndexing: false, EnableSearching: false, EnableAutocomplete: false},
        });
    } catch (error) {
        test.skip(true, `Skipping test - database search check failed: ${String(error)}`);
    }
}
