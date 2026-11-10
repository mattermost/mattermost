// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {OPENLDAP_ADMIN_PASSWORD, OPENLDAP_ALIAS, OPENLDAP_PORT, TESTCONTAINERS_LABELS} from './constants';
import {OPENLDAP_IMAGE} from './default_images';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

// osixia/openldap is known to occasionally fail its first boot under load — startWithRetry
// retries a bounded number of times rather than letting a flaky first attempt fail the whole run.
export async function startOpenldapContainer(network: StartedNetwork): Promise<StartedTestContainer> {
    return startWithRetry('openldap', async () => {
        let builder = new GenericContainer(OPENLDAP_IMAGE)
            .withExposedPorts(OPENLDAP_PORT)
            .withNetwork(network)
            .withNetworkAliases(OPENLDAP_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withEnvironment({
                LDAP_TLS_VERIFY_CLIENT: 'never',
                LDAP_ORGANISATION: 'Mattermost Test',
                LDAP_DOMAIN: 'mm.test.com',
                LDAP_ADMIN_PASSWORD: OPENLDAP_ADMIN_PASSWORD,
            })
            .withStartupTimeout(2 * 60_000)
            .withWaitStrategy(Wait.forListeningPorts());

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
