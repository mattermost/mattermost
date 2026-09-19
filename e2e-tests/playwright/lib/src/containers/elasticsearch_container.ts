// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {ELASTICSEARCH_ALIAS, ELASTICSEARCH_PORT, TESTCONTAINERS_LABELS} from './constants';
import {ELASTICSEARCH_VERSION as DEFAULT_ELASTICSEARCH_VERSION} from './default_images';
import {containerAssetPath} from './paths';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

// Built from a vendored Dockerfile, not the generic @testcontainers/elasticsearch wrapper — it
// installs the CJK analysis plugins (analysis-icu/nori/kuromoji/smartcn) real search tests rely on.
export async function startElasticsearchContainer(network: StartedNetwork): Promise<StartedTestContainer> {
    return startWithRetry('elasticsearch', async () => {
        // deleteOnExit: false — otherwise the built image bakes in this session's Ryuk id, so Ryuk
        // reaps the "reused" container the moment this session ends, defeating withReuse() below.
        const image = await GenericContainer.fromDockerfile(containerAssetPath(), 'Dockerfile.elasticsearch')
            .withBuildArgs({
                ELASTICSEARCH_VERSION: process.env.ELASTICSEARCH_VERSION || DEFAULT_ELASTICSEARCH_VERSION,
            })
            .build(undefined, {deleteOnExit: false});

        let builder = image
            .withExposedPorts(ELASTICSEARCH_PORT)
            .withNetwork(network)
            .withNetworkAliases(ELASTICSEARCH_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withEnvironment({
                'http.host': '0.0.0.0',
                'http.port': String(ELASTICSEARCH_PORT),
                'xpack.security.enabled': 'false',
                'action.destructive_requires_name': 'false',
                'transport.host': '127.0.0.1',
                ES_JAVA_OPTS: '-Xms512m -Xmx512m',
            })
            .withStartupTimeout(3 * 60_000)
            .withWaitStrategy(Wait.forHttp('/_cluster/health', ELASTICSEARCH_PORT).forStatusCode(200));

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
