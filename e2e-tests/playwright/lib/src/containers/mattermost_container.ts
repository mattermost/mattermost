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
        // Replaces the baseline for this key: appends mock file-server hosts (host.docker.internal
        // and the bridge gateway IP, set by startStack() once the network is up).
        MM_SERVICESETTINGS_ALLOWEDUNTRUSTEDINTERNALCONNECTIONS: [
            SERVER_ENV_BASELINE.MM_SERVICESETTINGS_ALLOWEDUNTRUSTEDINTERNALCONNECTIONS,
            'host.docker.internal',
            testConfig.testcontainersNetworkGatewayIp,
        ]
            .filter(Boolean)
            .join(' '),
    };
}

// Readiness requires both the /api/v4/system/ping health check AND the permissions-migration job
// scheduler's "All migrations are complete." log line (scheduler.go, jobs/migrations package).
// Ping alone isn't enough: MigrationKeyAdvancedPermissionsPhase2 runs as an async job whose
// scheduler deliberately delays its first tick 60s after startup — a real window a spec's very
// first API call can otherwise land inside, tripping IsPhase2MigrationCompleted() gates with
// "required migrations have not yet completed" (confirmed in practice: a permissions-page spec
// hit exactly this, with the "Edit Scheme" link stuck disabled, when this wait was dropped).
// Requires MM_LOGSETTINGS_CONSOLELEVEL=DEBUG (env_baseline.ts) since the scheduler logs that line
// at Debug. Only paid on a genuinely fresh boot — a reused/adopted stack skips this entirely.
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
            // Ensures host.docker.internal resolves to the Docker host (via host-gateway).
            .withExtraHosts([{host: 'host.docker.internal', ipAddress: 'host-gateway'}])
            .withLabels(TESTCONTAINERS_LABELS)
            .withExposedPorts(MATTERMOST_PORT)
            .withEnvironment(env)
            .withStartupTimeout(5 * 60_000)
            .withWaitStrategy(
                Wait.forAll([
                    Wait.forHttp('/api/v4/system/ping', MATTERMOST_PORT).forStatusCode(200),
                    Wait.forLogMessage(/All migrations are complete\./, 1),
                ]),
            );

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
