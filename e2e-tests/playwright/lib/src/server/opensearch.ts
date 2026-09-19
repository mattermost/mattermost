// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';
import type {AdminConfig} from '@mattermost/types/config';

import {OPENSEARCH_ADMIN_PASSWORD, OPENSEARCH_ALIAS, OPENSEARCH_PORT} from '../containers/constants';
import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

// The Mattermost server always connects to OpenSearch itself (indexing/search requests), so it
// needs the Testcontainers network alias, not a host-mapped address.
export function opensearchServerConfig(): Partial<AdminConfig['ElasticsearchSettings']> {
    return {
        ConnectionURL: `http://${OPENSEARCH_ALIAS}:${OPENSEARCH_PORT}`,
        Username: 'admin',
        Password: OPENSEARCH_ADMIN_PASSWORD,
        EnableIndexing: true,
        EnableSearching: true,
        EnableAutocomplete: true,
        Sniff: false,
    };
}

/**
 * Checks OpenSearch was started this run, restarts the server onto it if the OpenSearch Go client
 * isn't already the registered search engine, and confirms the server can actually reach it —
 * skipping the test otherwise, instead of failing on an unmet precondition. Backend picks which of
 * two Go implementations (Elasticsearch vs OpenSearch client) the server registers — a factory
 * invoked once at startup, never re-invoked by the config-change watcher — so switching it needs a
 * restart, unlike the rest of ElasticsearchSettings, which the watcher does pick up live.
 */
export async function ensureOpensearch(): Promise<void> {
    if (!testConfig.testcontainersServices.includes('opensearch')) {
        test.skip(true, 'Skipping test - opensearch not started (set PW_TESTCONTAINERS_SERVICES=opensearch)');
        return;
    }

    try {
        const env = {MM_ELASTICSEARCHSETTINGS_BACKEND: 'opensearch'};
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
        }

        const {adminClient} = await getAdminClient();
        await adminClient.patchConfig({ElasticsearchSettings: opensearchServerConfig()});
        await adminClient.testElasticsearch();
    } catch (error) {
        test.skip(true, `Skipping test - OpenSearch connection test failed: ${String(error)}`);
    }
}
