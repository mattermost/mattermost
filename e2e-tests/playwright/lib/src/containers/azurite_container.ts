// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {AZURITE_ALIAS, AZURITE_BLOB_PORT, TESTCONTAINERS_LABELS} from './constants';
import {AZURITE_IMAGE} from './default_images';

import {testConfig} from '@/test_config';

// An alternative to Minio for blob storage.
export async function startAzuriteContainer(network: StartedNetwork): Promise<StartedTestContainer> {
    let builder = new GenericContainer(AZURITE_IMAGE)
        .withCommand([
            'azurite-blob',
            '--blobHost',
            '0.0.0.0',
            '--blobPort',
            String(AZURITE_BLOB_PORT),
            '--skipApiVersionCheck',
        ])
        .withExposedPorts(AZURITE_BLOB_PORT)
        .withNetwork(network)
        .withNetworkAliases(AZURITE_ALIAS)
        .withLabels(TESTCONTAINERS_LABELS)
        .withWaitStrategy(Wait.forListeningPorts());

    if (testConfig.testcontainersReuse) {
        builder = builder.withReuse();
    }

    return builder.start();
}
