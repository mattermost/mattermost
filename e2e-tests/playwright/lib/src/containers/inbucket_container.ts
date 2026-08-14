// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {
    INBUCKET_ALIAS,
    INBUCKET_POP3_PORT,
    INBUCKET_SMTP_PORT,
    INBUCKET_WEB_PORT,
    TESTCONTAINERS_LABELS,
} from './constants';
import {INBUCKET_IMAGE} from './default_images';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

export async function startInbucketContainer(network: StartedNetwork): Promise<StartedTestContainer> {
    return startWithRetry('inbucket', async () => {
        let builder = new GenericContainer(INBUCKET_IMAGE)
            .withExposedPorts(INBUCKET_WEB_PORT, INBUCKET_SMTP_PORT, INBUCKET_POP3_PORT)
            .withNetwork(network)
            .withNetworkAliases(INBUCKET_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withEnvironment({
                INBUCKET_WEB_ADDR: `0.0.0.0:${INBUCKET_WEB_PORT}`,
                INBUCKET_POP3_ADDR: `0.0.0.0:${INBUCKET_POP3_PORT}`,
                INBUCKET_SMTP_ADDR: `0.0.0.0:${INBUCKET_SMTP_PORT}`,
            })
            .withWaitStrategy(Wait.forListeningPorts());

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
