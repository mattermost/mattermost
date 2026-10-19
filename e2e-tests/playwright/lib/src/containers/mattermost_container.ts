// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

import {GenericContainer, Wait} from 'testcontainers';
import type {BoundPorts, StartedTestContainer, WaitStrategy} from 'testcontainers';

import {isUpgradeToPhaseProjectActive} from '../upgrade_env';

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
import {logTestcontainers} from './log';
import {listServerContainerIdsSync, removeContainersSync, removeOrphanedServerContainers} from './orphans';
import {waitForHostPortFree} from './port';
import {NonRetryableError, startWithRetry} from './retry';

import {testConfig} from '@/test_config';
import {wait} from '@/util';

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

const execFileAsync = promisify(execFile);

const EXIT_POLL_MS = 500;
const EXIT_LOG_LINES = 40;

// Ready on the health ping only. Migrations that gate some APIs finish later; specs that need
// them call pw.ensurePhase2MigrationCompleted().
// Fails at once, with the container's last log lines, if the server exits instead of waiting out the startup timeout.
class ServerWaitStrategy implements WaitStrategy {
    private readonly ping = Wait.forHttp('/api/v4/system/ping', MATTERMOST_PORT).forStatusCode(200);

    withStartupTimeout(startupTimeoutMs: number): this {
        this.ping.withStartupTimeout(startupTimeoutMs);
        return this;
    }

    isStartupTimeoutSet(): boolean {
        return this.ping.isStartupTimeoutSet();
    }

    getStartupTimeout(): number {
        return this.ping.getStartupTimeout();
    }

    async waitUntilReady(
        container: Parameters<WaitStrategy['waitUntilReady']>[0],
        boundPorts: BoundPorts,
    ): Promise<void> {
        const watch = {active: true};
        const exited = (async () => {
            while (watch.active) {
                const {State} = await container.inspect();
                if (!State.Running) {
                    throw new NonRetryableError(await describeExit(container.id, State.ExitCode));
                }
                await wait(EXIT_POLL_MS);
            }
        })();

        try {
            await Promise.race([this.ping.waitUntilReady(container, boundPorts), exited]);
        } finally {
            watch.active = false;
            exited.catch(() => undefined);
        }
    }
}

// A Go crash dumps every goroutine after the panic line, so the excerpt starts at the panic when there is one.
async function describeExit(containerId: string, exitCode: number): Promise<string> {
    const {stdout, stderr} = await execFileAsync('docker', ['logs', '--tail', '500', containerId]);
    const lines = `${stdout}${stderr}`.split('\n').filter((line) => line && !line.includes('"level":"debug"'));
    const crash = lines.findIndex((line) => /^(panic:|fatal error:)/.test(line));
    const excerpt = crash === -1 ? lines.slice(-EXIT_LOG_LINES) : lines.slice(crash, crash + EXIT_LOG_LINES);
    return `Server container exited with code ${exitCode} before it became ready. ${crash === -1 ? 'Last' : 'Crash'} log lines:\n${excerpt.join('\n')}`;
}

// A failed start attempt can leave a created-but-never-started container that still reserves the server's port.
async function removeLeftoverServerContainers(): Promise<void> {
    const {stdout} = await execFileAsync('docker', [
        'ps',
        '-aq',
        '--filter',
        `ancestor=${testConfig.serverImage}`,
        '--filter',
        'status=created',
        '--filter',
        'status=exited',
        '--filter',
        'status=dead',
    ]);
    const ids = stdout.split('\n').filter(Boolean);
    if (ids.length > 0) {
        await execFileAsync('docker', ['rm', '-f', ...ids]);
        logTestcontainers(`removed ${ids.length} leftover server container(s) before starting.`);
    }
}

// Joins the network by name (withNetworkMode) rather than a StartedNetwork object, since
// restartMattermostContainer() calls this from a worker process that only has the network's name.
export async function startMattermostContainer(
    networkName: string,
    extraEnv: Record<string, string> = {},
): Promise<StartedTestContainer> {
    const env = resolveMattermostBootEnv(extraEnv);

    // Containers this start creates are removed if the process is interrupted or the start fails, so they can't be
    // left holding the server's port (SIGKILL can't be handled; the next start removes what it leaves).
    const existing = new Set(listServerContainerIdsSync(testConfig.serverImage));
    const removeCreated = () =>
        removeContainersSync(listServerContainerIdsSync(testConfig.serverImage).filter((id) => !existing.has(id)));
    const onSignal = (signal: NodeJS.Signals) => {
        removeCreated();
        process.off(signal, onSignal);
        // Our listener replaced the default exit; restore it unless another listener handles the signal.
        if (process.listenerCount(signal) === 0) {
            process.kill(process.pid, signal);
        }
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    try {
        return await startServerWithRetry(networkName, env);
    } catch (error) {
        removeCreated();
        throw error;
    } finally {
        process.off('SIGINT', onSignal);
        process.off('SIGTERM', onSignal);
    }
}

function startServerWithRetry(networkName: string, env: Record<string, string>): Promise<StartedTestContainer> {
    return startWithRetry('server', async () => {
        await removeLeftoverServerContainers();
        await removeOrphanedServerContainers();
        await waitForHostPortFree(MATTERMOST_FIXED_HOST_PORT);

        let builder = new GenericContainer(testConfig.serverImage)
            .withPlatform('linux/amd64') // The published server images are amd64-only.
            .withNetworkMode(networkName)
            .withNetworkAliases(MATTERMOST_ALIAS)
            // Ensures host.docker.internal resolves to the Docker host (via host-gateway).
            .withExtraHosts([{host: 'host.docker.internal', ipAddress: 'host-gateway'}])
            .withLabels(TESTCONTAINERS_LABELS)
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
            .withWaitStrategy(new ServerWaitStrategy());

        // Upgrade-swap-to skips reuse: the old container was rm -f'd and reuse could reattach to an
        // unrelated leftover on the same image tag. upgrade-from still needs withReuse() so Ryuk
        // doesn't reap the server before upgrade-to can adopt the stack. *Active: this restart can
        // run from a worker process (see restartMattermostContainer()), where only the env-var-aware
        // check resolves correctly (see upgrade_env.ts).
        if (testConfig.testcontainersReuse && !isUpgradeToPhaseProjectActive()) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
