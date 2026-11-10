// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {OPENSEARCH_ADMIN_PASSWORD, OPENSEARCH_ALIAS, OPENSEARCH_PORT, TESTCONTAINERS_LABELS} from './constants';
import {OPENSEARCH_VERSION as DEFAULT_OPENSEARCH_VERSION} from './default_images';
import {containerAssetPath} from './paths';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

// Built from a vendored Dockerfile (installs the same CJK analysis plugins as the
// Elasticsearch container) — an alternative to Elasticsearch for search.
export async function startOpensearchContainer(network: StartedNetwork): Promise<StartedTestContainer> {
    return startWithRetry('opensearch', async () => {
        // deleteOnExit: false — otherwise the built image bakes in this session's Ryuk id, so Ryuk
        // reaps the "reused" container the moment this session ends, defeating withReuse() below.
        const image = await GenericContainer.fromDockerfile(containerAssetPath(), 'Dockerfile.opensearch')
            .withBuildArgs({OPENSEARCH_VERSION: process.env.OPENSEARCH_VERSION || DEFAULT_OPENSEARCH_VERSION})
            .build(undefined, {deleteOnExit: false});

        let builder = image
            .withExposedPorts(OPENSEARCH_PORT)
            .withNetwork(network)
            .withNetworkAliases(OPENSEARCH_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withEnvironment({
                'http.port': String(OPENSEARCH_PORT),
                'discovery.type': 'single-node',
                'plugins.security.disabled': 'true',
                DISABLE_INSTALL_DEMO_CONFIG: 'true',
                OPENSEARCH_INITIAL_ADMIN_PASSWORD: OPENSEARCH_ADMIN_PASSWORD,
                OPENSEARCH_JAVA_OPTS: '-Xms512m -Xmx512m',
            })
            .withStartupTimeout(3 * 60_000)
            .withWaitStrategy(Wait.forHttp('/_cluster/health', OPENSEARCH_PORT).forStatusCode(200));

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
