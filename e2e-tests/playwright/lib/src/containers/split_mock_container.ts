// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {
    SPLIT_MOCK_ALIAS,
    SPLIT_MOCK_API_PORT,
    SPLIT_MOCK_CONTROL_PORT,
    SPLIT_MOCK_HOSTS,
    TESTCONTAINERS_LABELS,
} from './constants';
import {containerAssetPath} from './paths';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

// Stands in for the Split.io services the server syncs feature flags from, so pw.ensureFeatureFlag() can
// change a flag on the running server instead of restarting it. The server reaches it through network
// aliases for the split.io hostnames (and trusts its throwaway CA, see mattermost_container.ts); the
// harness drives it through the control port. Test infrastructure only: nothing here is shipped.
export async function startSplitMockContainer(network: StartedNetwork): Promise<StartedTestContainer> {
    return startWithRetry('splitmock', async () => {
        // deleteOnExit: false — see startWebhookContainer(): otherwise Ryuk reaps a "reused" container.
        const image = await GenericContainer.fromDockerfile(
            containerAssetPath('split-mock'),
            'Dockerfile.split-mock',
        ).build(undefined, {deleteOnExit: false});

        let builder = image
            .withExposedPorts(SPLIT_MOCK_CONTROL_PORT)
            .withNetwork(network)
            .withNetworkAliases(SPLIT_MOCK_ALIAS, ...SPLIT_MOCK_HOSTS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withEnvironment({
                SPLIT_HOSTS: SPLIT_MOCK_HOSTS.join(' '),
                SPLIT_PORT: String(SPLIT_MOCK_API_PORT),
                CONTROL_PORT: String(SPLIT_MOCK_CONTROL_PORT),
            })
            .withStartupTimeout(60_000)
            .withWaitStrategy(Wait.forHttp('/health', SPLIT_MOCK_CONTROL_PORT).forStatusCode(200));

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
