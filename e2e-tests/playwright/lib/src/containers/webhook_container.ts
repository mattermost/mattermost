// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {TESTCONTAINERS_LABELS, WEBHOOK_ALIAS, WEBHOOK_PORT} from './constants';
import {containerAssetPath} from './paths';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

// Vendored from e2e-tests/cypress/webhook_serve.js — the interactive-message/dialog callback
// sidecar tests point PW_WEBHOOK_BASE_URL at. Always started, unlike the other optional services,
// since testConfig.webhookBaseUrl defaults to localhost:3000 outside Testcontainers mode too.
export async function startWebhookContainer(network: StartedNetwork): Promise<StartedTestContainer> {
    return startWithRetry('webhook', async () => {
        // deleteOnExit: false — otherwise the built image bakes in this session's Ryuk id, so Ryuk
        // reaps the "reused" container the moment this session ends, defeating withReuse() below.
        const image = await GenericContainer.fromDockerfile(containerAssetPath('webhook'), 'Dockerfile.webhook').build(
            undefined,
            {deleteOnExit: false},
        );

        let builder = image
            .withExposedPorts(WEBHOOK_PORT)
            .withNetwork(network)
            .withNetworkAliases(WEBHOOK_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withWaitStrategy(Wait.forHttp('/', WEBHOOK_PORT).forStatusCode(200));

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
