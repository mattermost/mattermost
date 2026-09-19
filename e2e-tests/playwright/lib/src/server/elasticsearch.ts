// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';
import type {AdminConfig} from '@mattermost/types/config';

import {ELASTICSEARCH_ALIAS, ELASTICSEARCH_PORT} from '../containers/constants';
import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

// The Mattermost server always connects to Elasticsearch itself (indexing/search requests), so it
// needs the Testcontainers network alias, not a host-mapped address.
export function elasticsearchServerConfig(): Partial<AdminConfig['ElasticsearchSettings']> {
    return {
        ConnectionURL: `http://${ELASTICSEARCH_ALIAS}:${ELASTICSEARCH_PORT}`,
        EnableIndexing: true,
        EnableSearching: true,
        EnableAutocomplete: true,
        Sniff: false,
    };
}

/**
 * Checks Elasticsearch was started this run, restarts the server onto it if the Elasticsearch Go
 * client isn't already the registered search engine, and confirms the server can actually reach
 * it — skipping the test otherwise, instead of failing on an unmet precondition. Backend picks
 * which of two Go implementations (Elasticsearch vs OpenSearch client) the server registers — a
 * factory invoked once at startup, never re-invoked by the config-change watcher — so switching it
 * needs a restart, unlike the rest of ElasticsearchSettings, which the watcher does pick up live.
 */
export async function ensureElasticsearch(): Promise<void> {
    if (!testConfig.testcontainersServices.includes('elasticsearch')) {
        test.skip(true, 'Skipping test - elasticsearch not started (set PW_TESTCONTAINERS_SERVICES=elasticsearch)');
        return;
    }

    try {
        const env = {MM_ELASTICSEARCHSETTINGS_BACKEND: 'elasticsearch'};
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
        }

        const {adminClient} = await getAdminClient();
        await adminClient.patchConfig({ElasticsearchSettings: elasticsearchServerConfig()});
        await adminClient.testElasticsearch();
    } catch (error) {
        test.skip(true, `Skipping test - Elasticsearch connection test failed: ${String(error)}`);
    }
}
