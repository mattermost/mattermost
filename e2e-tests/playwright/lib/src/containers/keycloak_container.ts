// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {
    KEYCLOAK_ADMIN_PASSWORD,
    KEYCLOAK_ADMIN_USER,
    KEYCLOAK_ALIAS,
    KEYCLOAK_PORT,
    TESTCONTAINERS_LABELS,
} from './constants';
import {KEYCLOAK_IMAGE} from './default_images';
import {containerAssetPath} from './paths';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

export async function startKeycloakContainer(network: StartedNetwork): Promise<StartedTestContainer> {
    return startWithRetry('keycloak', async () => {
        let builder = new GenericContainer(KEYCLOAK_IMAGE)
            .withEntrypoint(['/opt/keycloak/bin/kc.sh'])
            .withCommand(['start', '--import-realm'])
            .withExposedPorts(KEYCLOAK_PORT)
            .withNetwork(network)
            .withNetworkAliases(KEYCLOAK_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withEnvironment({
                KEYCLOAK_ADMIN: KEYCLOAK_ADMIN_USER,
                KEYCLOAK_ADMIN_PASSWORD,
                KC_HOSTNAME_STRICT: 'false',
                KC_HOSTNAME_STRICT_HTTPS: 'false',
                KC_HTTP_ENABLED: 'true',
            })
            .withCopyFilesToContainer([
                {
                    source: containerAssetPath('keycloak-realm-export.json'),
                    target: '/opt/keycloak/data/import/realm-export.json',
                },
            ])
            .withStartupTimeout(3 * 60_000)
            .withWaitStrategy(Wait.forHttp('/realms/master', KEYCLOAK_PORT).forStatusCode(200));

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
