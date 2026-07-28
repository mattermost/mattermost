// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedTestContainer} from 'testcontainers';

import {
    INBUCKET_ALIAS,
    INBUCKET_SMTP_PORT,
    MATTERMOST_ALIAS,
    MATTERMOST_PORT,
    POSTGRES_ALIAS,
    POSTGRES_DB,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
    TESTCONTAINERS_LABELS,
} from './constants';
import {SERVER_ENV_BASELINE} from './env_baseline';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

// Env this container computes itself from the stack Testcontainers just built. Must win over any
// stray testConfig.serverEnv (MM_ENV) entry and over testConfig.bootEnvOverrides (passed in as
// `extraEnv` by restartMattermostContainer()), or a stray key collision there could break the
// server's own connectivity. Deliberately does NOT know about any additional service (LDAP/
// Keycloak/Elasticsearch/OpenSearch/Minio/Azurite) — those are each spec's own responsibility via
// pw.ensure<Service>(), which points the already-running server at them through patchConfig.
//
// MM_LICENSE (if set) is passed straight through: the server reads it directly at startup
// (platform.LoadLicense), so it boots already licensed instead of needing an authenticated upload
// call after the fact.
function structuralEnv(): Record<string, string> {
    return {
        MM_SQLSETTINGS_DRIVERNAME: 'postgres',
        MM_SQLSETTINGS_DATASOURCE: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_ALIAS}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable&connect_timeout=10&binary_parameters=yes`,
        MM_EMAILSETTINGS_SMTPSERVER: INBUCKET_ALIAS,
        MM_EMAILSETTINGS_SMTPPORT: String(INBUCKET_SMTP_PORT),
        ...(process.env.MM_LICENSE ? {MM_LICENSE: process.env.MM_LICENSE} : {}),
        // Overrides (not merges) SERVER_ENV_BASELINE's own value for this same key — appends the
        // network's gateway IP so the SSRF guard also allows fetching from file_server.ts's mock
        // file server, reachable at that address (see test_config.ts). Only known once the
        // network is up (testConfig.testcontainersNetworkGatewayIp is set by stack.ts's
        // startStack() before this container ever starts), so falls back to the baseline's own
        // value verbatim on the off chance this ever runs without it.
        MM_SERVICESETTINGS_ALLOWEDUNTRUSTEDINTERNALCONNECTIONS: testConfig.testcontainersNetworkGatewayIp
            ? `${SERVER_ENV_BASELINE.MM_SERVICESETTINGS_ALLOWEDUNTRUSTEDINTERNALCONNECTIONS} ${testConfig.testcontainersNetworkGatewayIp}`
            : SERVER_ENV_BASELINE.MM_SERVICESETTINGS_ALLOWEDUNTRUSTEDINTERNALCONNECTIONS,
    };
}

// Readiness is just the ping health check — weaker than also waiting for the permissions-
// migration job's "All migrations are complete." log line, so a spec's very first API call can
// occasionally trip an IsPhase2MigrationCompleted() gate on a fresh (non-reused) boot. Accepted
// to avoid the ~2min ping+migration wait every time.
//
// Joins the network by name (withNetworkMode) rather than a StartedNetwork object: also called
// from restartMattermostContainer(), which runs in a worker process that never holds the actual
// StartedNetwork handle — only the network's name (threaded through testConfig) is available
// there.
export async function startMattermostContainer(
    networkName: string,
    extraEnv: Record<string, string> = {},
): Promise<StartedTestContainer> {
    const env: Record<string, string> = {
        ...SERVER_ENV_BASELINE,
        ...testConfig.serverEnv,
        ...extraEnv,
        ...structuralEnv(),
    };

    return startWithRetry('server', async () => {
        let builder = new GenericContainer(testConfig.serverImage)
            .withPlatform('linux/amd64') // The published server images are amd64-only.
            .withNetworkMode(networkName)
            .withNetworkAliases(MATTERMOST_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withExposedPorts(MATTERMOST_PORT)
            .withEnvironment(env)
            .withStartupTimeout(5 * 60_000)
            .withWaitStrategy(Wait.forHttp('/api/v4/system/ping', MATTERMOST_PORT).forStatusCode(200));

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
