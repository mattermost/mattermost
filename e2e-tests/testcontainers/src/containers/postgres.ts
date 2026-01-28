// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostgreSqlContainer, StartedPostgreSqlContainer} from '@testcontainers/postgresql';
import {StartedNetwork} from 'testcontainers';

import {getPostgresImage, DEFAULT_CREDENTIALS, INTERNAL_PORTS} from '../config/defaults';
import {PostgresConnectionInfo} from '../config/types';
import {createFileLogConsumer} from '../utils/log';

const POSTGRES_CONFIG = `
max_connections = 500
listen_addresses = '*'
fsync = off
full_page_writes = off
default_text_search_config = 'pg_catalog.english'
commit_delay = 1000
logging_collector = off
password_encryption = 'scram-sha-256'
`;

const POSTGRES_INIT_SQL = `
CREATE DATABASE mattermost_node_test;
GRANT ALL PRIVILEGES ON DATABASE mattermost_node_test TO mmuser;
`;

export interface PostgresConfig {
    image?: string;
    database?: string;
    username?: string;
    password?: string;
}

export async function createPostgresContainer(
    network: StartedNetwork,
    config: PostgresConfig = {},
): Promise<StartedPostgreSqlContainer> {
    const image = config.image ?? getPostgresImage();
    const database = config.database ?? DEFAULT_CREDENTIALS.postgres.database;
    const username = config.username ?? DEFAULT_CREDENTIALS.postgres.username;
    const password = config.password ?? DEFAULT_CREDENTIALS.postgres.password;

    const container = await new PostgreSqlContainer(image)
        .withNetwork(network)
        .withNetworkAliases('postgres')
        .withDatabase(database)
        .withUsername(username)
        .withPassword(password)
        .withEnvironment({
            POSTGRES_INITDB_ARGS: '--auth-host=scram-sha-256 --auth-local=scram-sha-256',
        })
        .withCopyContentToContainer([
            {content: POSTGRES_CONFIG, target: '/etc/postgresql/postgresql.conf'},
            {content: POSTGRES_INIT_SQL, target: '/docker-entrypoint-initdb.d/init.sql'},
        ])
        .withCommand(['postgres', '-c', 'config_file=/etc/postgresql/postgresql.conf'])
        .withLogConsumer(createFileLogConsumer('postgres'))
        .withStartupTimeout(60_000)
        .start();

    return container;
}

export function getPostgresConnectionInfo(
    container: StartedPostgreSqlContainer,
    image: string,
): PostgresConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.postgres);
    const database = container.getDatabase();
    const username = container.getUsername();
    const password = container.getPassword();
    const connectionString = `postgres://${username}:${password}@${host}:${port}/${database}?sslmode=disable`;

    return {
        host,
        port,
        database,
        username,
        password,
        connectionString,
        image,
    };
}
