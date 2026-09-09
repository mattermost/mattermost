// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {MINIO_ACCESS_KEY, MINIO_ALIAS, MINIO_PORT, MINIO_SECRET_KEY, TESTCONTAINERS_LABELS} from './constants';
import {MINIO_IMAGE} from './default_images';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

export async function startMinioContainer(network: StartedNetwork): Promise<StartedTestContainer> {
    return startWithRetry('minio', async () => {
        let builder = new GenericContainer(MINIO_IMAGE)
            .withCommand(['server', '/data', '--console-address', ':9002'])
            .withExposedPorts(MINIO_PORT)
            .withNetwork(network)
            .withNetworkAliases(MINIO_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withEnvironment({
                MINIO_ROOT_USER: MINIO_ACCESS_KEY,
                MINIO_ROOT_PASSWORD: MINIO_SECRET_KEY,
            })
            .withWaitStrategy(Wait.forHttp('/minio/health/live', MINIO_PORT).forStatusCode(200));

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
