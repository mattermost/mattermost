// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostgreSqlContainer} from '@testcontainers/postgresql';
import type {StartedPostgreSqlContainer} from '@testcontainers/postgresql';
import {Wait} from 'testcontainers';
import type {StartedNetwork} from 'testcontainers';

import {POSTGRES_ALIAS, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, TESTCONTAINERS_LABELS} from './constants';
import {POSTGRES_IMAGE} from './default_images';
import {containerAssetPath} from './paths';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

export async function startPostgresContainer(network: StartedNetwork): Promise<StartedPostgreSqlContainer> {
    return startWithRetry('postgres', async () => {
        let builder = new PostgreSqlContainer(POSTGRES_IMAGE)
            .withDatabase(POSTGRES_DB)
            .withUsername(POSTGRES_USER)
            .withPassword(POSTGRES_PASSWORD)
            .withNetwork(network)
            .withNetworkAliases(POSTGRES_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withCopyFilesToContainer([
                {
                    source: containerAssetPath('postgres.conf'),
                    target: '/etc/postgresql/postgresql.conf',
                },
            ])
            .withCommand(['postgres', '-c', 'config_file=/etc/postgresql/postgresql.conf'])
            .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 1));

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
