// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedTestContainer} from 'testcontainers';

import {isUpgradeFromProjectSelected, isUpgradeToPhaseProjectSelected} from '../upgrade_env';

import {
    INBUCKET_ALIAS,
    INBUCKET_SMTP_PORT,
    MATTERMOST_DATA_DIR,
    MATTERMOST_ALIAS,
    MATTERMOST_FIXED_HOST_PORT,
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
// stray testConfig.serverEnv (MM_ENV) or bootEnvOverrides entry to avoid breaking the server's own
// connectivity. Does not configure additional services (LDAP/Keycloak/etc.) — each spec enables
// those itself via pw.ensure<Service>().
export function resolveMattermostBootEnv(extraEnv: Record<string, string> = {}): Record<string, string> {
    return {
        ...SERVER_ENV_BASELINE,
        ...testConfig.serverEnv,
        ...extraEnv,
        ...structuralEnv(),
    };
}

const POSTGRES_DSN = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_ALIAS}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable&connect_timeout=10&binary_parameters=yes`;

function structuralEnv(): Record<string, string> {
    return {
        // Config lives in Postgres (DatabaseStore) rather than /mattermost/config/config.json, so
        // it survives restartMattermostContainer() and the upgrade swap instead of being reset to
        // the image's shipped defaults.
        MM_CONFIG: POSTGRES_DSN,
        MM_SQLSETTINGS_DRIVERNAME: 'postgres',
        MM_SQLSETTINGS_DATASOURCE: POSTGRES_DSN,
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

// Readiness requires both the /api/v4/system/ping health check and the permissions-migration
// job's "All migrations are complete." log line. Ping alone can race
// MigrationKeyAdvancedPermissionsPhase2, whose scheduler delays its first tick 60s after startup,
// tripping IsPhase2MigrationCompleted() gates on a spec's first API call. Requires
// MM_LOGSETTINGS_CONSOLELEVEL=DEBUG, since the scheduler logs that line at Debug.
//
// Upgrade projects skip the log wait: they're API-only, and restarts/reuse can miss the log line
// after the old container is removed.
function mattermostWaitStrategy() {
    const ping = Wait.forHttp('/api/v4/system/ping', MATTERMOST_PORT).forStatusCode(200);
    if (isUpgradeFromProjectSelected() || isUpgradeToPhaseProjectSelected()) {
        return ping;
    }
    return Wait.forAll([ping, Wait.forLogMessage(/All migrations are complete\./, 1)]);
}

// Joins the network by name (withNetworkMode) rather than a StartedNetwork object, since
// restartMattermostContainer() calls this from a worker process that only has the network's name.
export async function startMattermostContainer(
    networkName: string,
    extraEnv: Record<string, string> = {},
): Promise<StartedTestContainer> {
    const env = resolveMattermostBootEnv(extraEnv);

    return startWithRetry('server', async () => {
        let builder = new GenericContainer(testConfig.serverImage)
            .withPlatform('linux/amd64') // The published server images are amd64-only.
            .withNetworkMode(networkName)
            .withNetworkAliases(MATTERMOST_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            // Ensures host.docker.internal resolves to the Docker host (via host-gateway).
            .withExtraHosts([{host: 'host.docker.internal', ipAddress: 'host-gateway'}])
            // Fixed rather than random: a random host port would change on every
            // restartMattermostContainer(), staling a host-reachable ServiceSettings.SiteURL
            // (see server_env.ts's ensureSiteUrl()) the moment the container is replaced.
            .withExposedPorts({container: MATTERMOST_PORT, host: MATTERMOST_FIXED_HOST_PORT})
            .withEnvironment(env)
            // Bind-mounted unconditionally so local-disk FileSettings data survives
            // restartMattermostContainer()'s docker rm -f; a harmless empty directory when a
            // different FileSettings backend (Minio/Azurite) is active.
            .withBindMounts([{source: MATTERMOST_DATA_DIR, target: '/mattermost/data', mode: 'rw'}])
            .withStartupTimeout(5 * 60_000)
            .withWaitStrategy(mattermostWaitStrategy());

        // Upgrade-swap-to skips reuse: the old container was rm -f'd and reuse could reattach to an
        // unrelated leftover on the same image tag. upgrade-from still needs withReuse() so Ryuk
        // doesn't reap the server before upgrade-to can adopt the stack.
        if (testConfig.testcontainersReuse && !isUpgradeToPhaseProjectSelected()) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
