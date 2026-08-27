// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFile} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';

import {test} from '@playwright/test';
import type {StartedPostgreSqlContainer} from '@testcontainers/postgresql';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {
    AZURITE_ALIAS,
    AZURITE_BLOB_PORT,
    ELASTICSEARCH_ALIAS,
    ELASTICSEARCH_PORT,
    INBUCKET_ALIAS,
    INBUCKET_WEB_PORT,
    KEYCLOAK_ALIAS,
    KEYCLOAK_PORT,
    LOCAL_STORAGE_DIR,
    MATTERMOST_ALIAS,
    MATTERMOST_PORT,
    MINIO_ALIAS,
    MINIO_PORT,
    OPENLDAP_ALIAS,
    OPENLDAP_PORT,
    OPENSEARCH_ALIAS,
    OPENSEARCH_PORT,
    POSTGRES_ALIAS,
    POSTGRES_DB,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
    WEBHOOK_ALIAS,
    WEBHOOK_PORT,
} from './constants';
import {
    AZURITE_IMAGE,
    ELASTICSEARCH_VERSION,
    INBUCKET_IMAGE,
    KEYCLOAK_IMAGE,
    MINIO_IMAGE,
    OPENLDAP_IMAGE,
    OPENSEARCH_VERSION,
    POSTGRES_IMAGE,
} from './default_images';
import {startInbucketContainer} from './inbucket_container';
import {logTestcontainers} from './log';
import {resolveMattermostBootEnv, startMattermostContainer} from './mattermost_container';
import {getNetwork, getNetworkGatewayIp, stopNetwork} from './network';
import {startPostgresContainer} from './postgres_container';
import {ADDITIONAL_SERVICE_STARTERS} from './requirements';
import {startWebhookContainer} from './webhook_container';

import {clearClientCache} from '@/server/client';
import {defaultBootEnv, testConfig} from '@/test_config';
import type {TestContainersServiceName} from '@/test_config';
import {duration} from '@/util';

const execFileAsync = promisify(execFile);

const ENV_FILE_PATH = path.resolve(process.cwd(), '.env.testcontainers');
const LOG_DIR = path.resolve(process.cwd(), 'logs');

type StartedStack = {
    network: StartedNetwork;
    postgres: StartedPostgreSqlContainer;
    inbucket: StartedTestContainer;
    webhook: StartedTestContainer;
    mattermost: StartedTestContainer;
    additional: Partial<Record<TestContainersServiceName, StartedTestContainer>>;
};

let started: StartedStack | undefined;
// True if this process is running against a stack an EARLIER process created (via
// reuseExistingStack()) rather than one it started itself — there are no real Testcontainers
// handles to hold in this case, only values .env.testcontainers resolved into testConfig via
// dotenv. A reusing process never owns the stack's lifecycle, so stopStack() must leave both
// the containers and the env file untouched for whatever other process still needs them.
let reused = false;

/**
 * Brings up a bridge network, Postgres, Inbucket, the Mattermost server, and whichever
 * additional services testConfig.testcontainersServices names. No-op if `testcontainers` mode isn't
 * selected (PW_USE_TESTCONTAINERS unset), already started (repeated calls within the same
 * process, e.g. a stray double-invocation, are harmless), or already reused. Otherwise first
 * checks whether an earlier process's stack is still alive and reuses it instead — see
 * reuseExistingStack().
 */
export async function startStack(): Promise<void> {
    if (!testConfig.useTestContainers || started || reused) {
        return;
    }

    if (await reuseExistingStack()) {
        return;
    }

    // reuseExistingStack() found nothing live to reuse — any bootEnvOverrides read from a stale
    // .env.testcontainers (e.g. left behind by a manual `docker rm` or a crashed prior process)
    // no longer describes anything real. Reset to the genuine defaults the container about to be
    // created will actually boot with, or a later restart could wrongly believe some stale
    // setting is already active and skip a restart it actually needs.
    testConfig.bootEnvOverrides = defaultBootEnv();

    // Same reasoning for local-disk file storage: a fixed, repo-relative bind-mount directory
    // (see LOCAL_STORAGE_DIR) persists across genuinely unrelated runs, unlike a fresh container's
    // own storage, which always starts empty. Only reset on a real fresh boot — never on adoption
    // (reuseExistingStack() already returned above in that case) — so an upgrade test's from-phase
    // data survives into its to-phase.
    fs.rmSync(LOCAL_STORAGE_DIR, {recursive: true, force: true});
    fs.mkdirSync(LOCAL_STORAGE_DIR);
    fs.chmodSync(LOCAL_STORAGE_DIR, 0o777);

    const network = await getNetwork();

    if (testConfig.containerRunner) {
        await joinSelfToNetwork(network.getId());
    }

    // Stored so a host-side mock file server can be reached from both the browser and containers
    // on this network (see getNetworkGatewayIp).
    testConfig.testcontainersNetworkGatewayIp = await getNetworkGatewayIp(network.getId());

    const additionalNames = testConfig.testcontainersServices;

    logTestcontainers(
        `pulling/starting images: server, postgres, inbucket, webhook${additionalNames.length ? `, ${additionalNames.join(', ')}` : ''}`,
    );
    await logServerImageAge(testConfig.serverImage);

    // Tracks every container that actually comes up, independent of whether the group as a whole
    // (or the mattermost start after it) ultimately succeeds — so a failure partway through still
    // knows exactly what to tear down instead of leaking whatever already started.
    const startedContainers: StartedTestContainer[] = [];
    const trackAndLog = <T extends StartedTestContainer>(name: string, promise: Promise<T>): Promise<T> => {
        const startedAt = Date.now();

        // The biggest blind spot is the server: its own wait strategy alone can take minutes
        // (see mattermost_container.ts), during which nothing else prints — so ping every 30s to
        // make clear the run hasn't stalled.
        const heartbeat = setInterval(() => {
            logTestcontainers(`still waiting on ${name} (${elapsedSeconds(startedAt)}s elapsed)...`);
        }, duration.half_min);

        return promise.then(
            (container) => {
                clearInterval(heartbeat);
                startedContainers.push(container);
                logTestcontainers(`${name} ready in ${elapsedSeconds(startedAt)}s.`);
                return container;
            },
            (error) => {
                clearInterval(heartbeat);
                throw error;
            },
        );
    };

    try {
        const [postgres, inbucket, webhook, ...additionalContainers] = await Promise.all([
            trackAndLog('postgres', startPostgresContainer(network)),
            trackAndLog('inbucket', startInbucketContainer(network)),
            trackAndLog('webhook', startWebhookContainer(network)),
            ...additionalNames.map((name) => trackAndLog(name, ADDITIONAL_SERVICE_STARTERS[name](network))),
        ]);

        const additional: Partial<Record<TestContainersServiceName, StartedTestContainer>> = {};
        additionalNames.forEach((name, index) => {
            additional[name] = additionalContainers[index];
        });

        const mattermost = await trackAndLog('server', startMattermostContainer(network.getName()));

        started = {network, postgres, inbucket, webhook, mattermost, additional};
    } catch (error) {
        await Promise.allSettled(startedContainers.map((container) => container.stop()));
        await stopNetwork();
        throw error;
    }

    applyResolvedConfig(started);
    resetEnvFile('initial boot');

    logStackStarted(started);
}

/**
 * True if .env.testcontainers points at a Mattermost container that's still running — i.e. some
 * OTHER process already brought up a stack this process should reuse instead of duplicating.
 * Always a different process (the only channel between them is the env file, not runtime IPC);
 * covers PW_TESTCONTAINERS_REUSE=true across separate local invocations, and a CI dispatcher that
 * starts the server once per worker job and runs one spec per process against it.
 *
 * Deliberately does not gate on testConfig.testcontainersReuse: that flag governs whether the
 * OWNING process leaves the stack running on its own exit — a different decision from whether
 * THIS process should reuse a stack it finds already alive. Reuse always applies once liveness
 * is confirmed.
 */
async function reuseExistingStack(): Promise<boolean> {
    if (!testConfig.mattermostContainerId || !(await isContainerRunning(testConfig.mattermostContainerId))) {
        return false;
    }

    reused = true;

    if (testConfig.containerRunner) {
        await joinSelfToNetwork(testConfig.testcontainersNetworkName);
    }

    logTestcontainers(
        'reusing already-running server (with PW_TESTCONTAINERS_REUSE=true), see .env.testcontainers for stack information',
    );
    logStackReused();
    return true;
}

// Same shape of summary as logStackStarted(), but built from testConfig's resolved fields
// instead of live StartedTestContainer handles — reusing never gets those (see `reused`'s
// declaration above), only whatever an EARLIER process's startStack() persisted to
// .env.testcontainers and this process's dotenv.config() read back into testConfig.
function logStackReused(): void {
    const lines: string[] = [
        `  - ${'server'.padEnd(13)} = ${testConfig.baseURL}`,
        `  - ${'postgres'.padEnd(13)} = ${testConfig.postgresUrl}`,
        `  - ${'inbucket'.padEnd(13)} = ${testConfig.smtpURL}`,
        `  - ${'webhook'.padEnd(13)} = ${testConfig.webhookBaseUrl}`,
    ];

    const additionalUrls: Record<TestContainersServiceName, string> = {
        openldap: `${testConfig.ldapHost}:${testConfig.ldapPort}`,
        keycloak: testConfig.keycloakUrl,
        elasticsearch: testConfig.elasticsearchUrl,
        opensearch: testConfig.opensearchUrl,
        minio: testConfig.minioUrl,
        azurite: testConfig.azuriteUrl,
    };
    testConfig.testcontainersServices.forEach((name) => {
        lines.push(`  - ${name.padEnd(13)} = ${additionalUrls[name]}`);
    });

    // eslint-disable-next-line no-console
    console.log(
        `Testcontainers (reused, network ${testConfig.testcontainersNetworkName}, tear down with: "npm run testcontainers:down"):\n${lines.join('\n')}\n${formatServerEnvSummary()}\n`,
    );
}

async function isContainerRunning(containerId: string): Promise<boolean> {
    try {
        const {stdout} = await execFileAsync('docker', ['inspect', '-f', '{{.State.Running}}', containerId]);
        return stdout.trim() === 'true';
    } catch {
        return false;
    }
}

/**
 * Tears down the stack: always collects logs and removes the generated env file; only actually
 * stops containers when reuse isn't enabled (PW_TESTCONTAINERS_REUSE=true leaves them running
 * for the next invocation — local or a CI dispatcher's next spec — to reuse).
 *
 * A no-op beyond clearing the local flag when this process reused rather than created the stack:
 * it never owned the containers or the env file, so it must leave both exactly as it found them
 * for whichever process (or later dispatch) still depends on them.
 */
export async function stopStack(options: {force?: boolean} = {}): Promise<void> {
    if (!testConfig.useTestContainers) {
        return;
    }

    if (reused) {
        reused = false;
        logTestcontainers('this process reused an existing server — leaving it untouched.');
        return;
    }

    if (!started) {
        return;
    }

    const stack = started;
    await collectLogs(stack);

    const shouldStop = options.force || !testConfig.testcontainersReuse;
    if (shouldStop) {
        await Promise.allSettled([
            stack.mattermost.stop(),
            stack.inbucket.stop(),
            stack.webhook.stop(),
            stack.postgres.stop(),
            ...Object.values(stack.additional).map((container) => container?.stop()),
        ]);
        await stopNetwork();
        logStackStopped(stack);
        archiveEnvFile();
        removeEnvFile();
    } else {
        logStackLeftRunning(stack);
    }

    started = undefined;
}

/**
 * True if every key in `env` already has the given value in testConfig.bootEnvOverrides — i.e.
 * the currently-running Mattermost container was already booted this way, so a pw.ensure*() can
 * skip restartMattermostContainer() for these settings.
 */
export function bootEnvMatches(env: Record<string, string>): boolean {
    return Object.entries(env).every(([key, value]) => testConfig.bootEnvOverrides[key] === value);
}

/**
 * Stops the current Mattermost container and starts a fresh one with additional env merged in —
 * used for settings like FileSettings.DriverName, ElasticsearchSettings.Backend, or
 * MM_FEATUREFLAGS_* which are never re-read from a running server, so patchConfig alone can't
 * change them.
 *
 * Safe to call from a Playwright worker process, unlike startStack()/stopStack(): it works from
 * testConfig's container id and network name rather than the in-process StartedStack, since
 * global setup (which owns that in-process state) and worker processes are different OS
 * processes.
 *
 * `env` is merged into testConfig.bootEnvOverrides (not replaced) so an earlier pw.ensure*()
 * call's settings survive a later, unrelated one restarting the same container again. The merged
 * result, new container id, and new baseURL are appended to .env.testcontainers so any other
 * process picks up the real current state instead of a stale or default one.
 *
 * Always performs the restart without checking whether `env` is already active — callers (e.g.
 * ensureMinio()/ensureAzurite()) own that decision via bootEnvMatches().
 */
export async function restartMattermostContainer(env: Record<string, string>): Promise<void> {
    if (!testConfig.useTestContainers) {
        throw new Error('restartMattermostContainer requires PW_USE_TESTCONTAINERS=true.');
    }
    if (!testConfig.mattermostContainerId || !testConfig.testcontainersNetworkName) {
        throw new Error(
            'No running Testcontainers stack to restart (missing Mattermost container id or network name).',
        );
    }

    extendTimeoutForRestart();

    testConfig.bootEnvOverrides = {...testConfig.bootEnvOverrides, ...env};

    await execFileAsync('docker', ['rm', '-f', testConfig.mattermostContainerId]);

    const mattermost = await startMattermostContainer(
        testConfig.testcontainersNetworkName,
        testConfig.bootEnvOverrides,
    );

    testConfig.baseURL = resolveUrl(mattermost, MATTERMOST_PORT, MATTERMOST_ALIAS);
    testConfig.mattermostContainerId = mattermost.getId();
    clearClientCache();

    appendEnvFile(`restart requested by ${describeCurrentTest()} — env ${JSON.stringify(env)}`);

    logTestcontainers(`restarted server with ${JSON.stringify(env)}.`);
}

// Identifies whichever spec/test is currently driving a restart, so .env.testcontainers's history
// shows why the server ended up in its current state. restartMattermostContainer() is always
// called from inside a running test, so test.info() should resolve; the fallback only guards a
// future caller that isn't.
function describeCurrentTest(): string {
    try {
        const info = test.info();
        return `${path.relative(process.cwd(), info.file)} > ${info.title}`;
    } catch {
        return 'unknown caller (not running inside a test)';
    }
}

// startMattermostContainer()'s wait strategy blocks on a scheduler log line whose first tick is
// deliberately delayed 60s after startup (see that function's comment), so a restart alone can
// exceed the suite's default 60s test timeout before the test has done any of its own work.
// Playwright's timeout wouldn't cancel the still-in-flight restart, so a timed-out retry can race
// it and hit a container mid-swap. Raising (not just extending) the timeout avoids ratcheting it
// down if a later restart in the same test calls this again after some budget is already spent.
function extendTimeoutForRestart(): void {
    try {
        const info = test.info();
        info.setTimeout(Math.max(info.timeout, duration.four_min));
    } catch {
        // Not running inside a test (e.g. called from a script) — nothing to extend.
    }
}

// containerRunner mode: join the calling `playwright` container to the same network so its own
// connections can use aliases too, instead of mapped ports. Relies on Docker setting the
// container's hostname to its own container ID by default, and on the `docker` CLI being
// present alongside the mounted socket.
//
// Takes a network name/ID string rather than a StartedNetwork object: reuseExistingStack() only
// has testConfig.testcontainersNetworkName (read from .env.testcontainers) to work with, not a
// live handle — and the docker CLI resolves either form the same way, so the freshly-created path
// below just passes network.getId() instead.
async function joinSelfToNetwork(networkId: string): Promise<void> {
    const selfContainerId = os.hostname();
    try {
        await execFileAsync('docker', ['network', 'connect', networkId, selfContainerId]);
    } catch (error) {
        // A CI dispatcher running one spec per process reuses the same stack (and this same
        // runner container) on every invocation, so this join is attempted again every time —
        // already-connected isn't a failure, it's the expected steady state after the first.
        if (String(error).includes('already exists in network')) {
            return;
        }
        throw new Error(
            'containerRunner mode (PW_TESTCONTAINERS_CONTAINER_RUNNER=true) requires the calling container ' +
                'to join the Testcontainers network, but "docker network connect" failed for container ' +
                `"${selfContainerId}": ${String(error)}. Ensure /var/run/docker.sock is mounted and the docker ` +
                'CLI is installed in this image.',
        );
    }
}

function resolveUrl(container: StartedTestContainer, port: number, alias: string): string {
    if (testConfig.containerRunner) {
        return `http://${alias}:${port}`;
    }
    return `http://${container.getHost()}:${container.getMappedPort(port)}`;
}

function resolveHostAndPort(container: StartedTestContainer, port: number, alias: string): [string, number] {
    if (testConfig.containerRunner) {
        return [alias, port];
    }
    return [container.getHost(), container.getMappedPort(port)];
}

// Same containerRunner-aware resolution as resolveUrl()/resolveHostAndPort() above: the alias in
// containerRunner mode (the test process is on the Testcontainers network), the host-mapped port
// otherwise — direct-DB specs are just another client connecting from wherever the test process
// runs.
function resolvePostgresUrl(postgres: StartedPostgreSqlContainer): string {
    const [host, port] = resolveHostAndPort(postgres, POSTGRES_PORT, POSTGRES_ALIAS);
    return `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${host}:${port}/${POSTGRES_DB}?sslmode=disable&connect_timeout=10&binary_parameters=yes`;
}

type ContainerMetadata = {alias: string; port: number; image: string};

const ADDITIONAL_CONTAINER_METADATA: Record<TestContainersServiceName, ContainerMetadata> = {
    openldap: {alias: OPENLDAP_ALIAS, port: OPENLDAP_PORT, image: OPENLDAP_IMAGE},
    keycloak: {alias: KEYCLOAK_ALIAS, port: KEYCLOAK_PORT, image: KEYCLOAK_IMAGE},
    elasticsearch: {
        alias: ELASTICSEARCH_ALIAS,
        port: ELASTICSEARCH_PORT,
        image: `built, Elasticsearch ${ELASTICSEARCH_VERSION}`,
    },
    opensearch: {alias: OPENSEARCH_ALIAS, port: OPENSEARCH_PORT, image: `built, OpenSearch ${OPENSEARCH_VERSION}`},
    minio: {alias: MINIO_ALIAS, port: MINIO_PORT, image: MINIO_IMAGE},
    azurite: {alias: AZURITE_ALIAS, port: AZURITE_BLOB_PORT, image: AZURITE_IMAGE},
};

function containerEntries(stack: StartedStack): Array<[string, StartedTestContainer, ContainerMetadata]> {
    const base: Array<[string, StartedTestContainer, ContainerMetadata]> = [
        ['server', stack.mattermost, {alias: MATTERMOST_ALIAS, port: MATTERMOST_PORT, image: testConfig.serverImage}],
        ['postgres', stack.postgres, {alias: POSTGRES_ALIAS, port: POSTGRES_PORT, image: POSTGRES_IMAGE}],
        ['inbucket', stack.inbucket, {alias: INBUCKET_ALIAS, port: INBUCKET_WEB_PORT, image: INBUCKET_IMAGE}],
        ['webhook', stack.webhook, {alias: WEBHOOK_ALIAS, port: WEBHOOK_PORT, image: 'built, webhook sidecar'}],
    ];

    const additional = Object.entries(stack.additional)
        .filter((entry): entry is [TestContainersServiceName, StartedTestContainer] => entry[1] !== undefined)
        .map((entry): [string, StartedTestContainer, ContainerMetadata] => [
            entry[0],
            entry[1],
            ADDITIONAL_CONTAINER_METADATA[entry[0]],
        ]);

    return [...base, ...additional];
}

function formatContainerLine(name: string, container: StartedTestContainer, metadata: ContainerMetadata): string {
    const host = `${container.getHost()}:${container.getMappedPort(metadata.port)}`;
    return `  - ${name.padEnd(13)} = ${metadata.image} (network: ${metadata.alias}:${metadata.port}, host: ${host})`;
}

function elapsedSeconds(startedAt: number): string {
    return ((Date.now() - startedAt) / 1000).toFixed(1);
}

// `master`/`release-*` tags get rebuilt continuously, so a cached copy can silently go stale;
// pinned version tags (e.g. `:11.10.0`) never change, so they're excluded.
const MUTABLE_IMAGE_TAG_PATTERN = /:(master|release-.+)$/;

async function logServerImageAge(image: string): Promise<void> {
    let created: Date;
    try {
        const {stdout} = await execFileAsync('docker', ['image', 'inspect', image, '--format', '{{.Created}}']);
        created = new Date(stdout.trim());
    } catch {
        // Not cached locally — Testcontainers will pull it fresh as part of starting the
        // container, so whatever comes up is already the latest build. Nothing to warn about.
        logTestcontainers(`server image "${image}" isn't cached locally yet — will pull the latest build.`);
        return;
    }

    const ageHours = (Date.now() - created.getTime()) / (60 * 60 * 1000);
    const age = ageHours >= 48 ? `${(ageHours / 24).toFixed()}d` : `${ageHours.toFixed()}h`;
    const looksStale = MUTABLE_IMAGE_TAG_PATTERN.test(image) && ageHours > 24;

    logTestcontainers(
        `server image "${image}" (built ${created.toISOString()}, ${age} ago).` +
            (looksStale
                ? ` This is a moving tag and the cached copy may be outdated — run "docker pull ${image}" for the latest build.`
                : ''),
    );
}

function logStackStarted(stack: StartedStack): void {
    const lines = containerEntries(stack).map(([name, container, metadata]) =>
        formatContainerLine(name, container, metadata),
    );
    // eslint-disable-next-line no-console
    console.log(`Testcontainers (network ${stack.network.getId()}):\n${lines.join('\n')}\n${formatServerEnvSummary()}`);
}

const SENSITIVE_SERVER_ENV_KEYS = new Set([
    'MM_LICENSE',
    'MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY',
    'MM_FILESETTINGS_AZUREACCESSKEY',
]);

function redactServerEnvValue(key: string, value: string): string {
    if (SENSITIVE_SERVER_ENV_KEYS.has(key)) {
        return '***';
    }
    if (key === 'MM_SQLSETTINGS_DATASOURCE') {
        return value.replace(/:([^:@/]+)@/, ':***@');
    }
    return value;
}

function formatServerEnvSummary(): string {
    const env = resolveMattermostBootEnv(testConfig.bootEnvOverrides);
    const lines = Object.entries(env)
        .filter(([key]) => key.startsWith('MM_'))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `  - ${key} = ${redactServerEnvValue(key, value)}`);

    return `server env (MM_*):\n${lines.join('\n')}`;
}

function logStackStopped(stack: StartedStack): void {
    const names = containerEntries(stack).map(([name]) => name);
    logTestcontainers(`stopped ${names.join(', ')}.`);
}

function logStackLeftRunning(stack: StartedStack): void {
    const serverUrl = resolveUrl(stack.mattermost, MATTERMOST_PORT, MATTERMOST_ALIAS);
    logTestcontainers(
        `left running (PW_TESTCONTAINERS_REUSE=true) — server reachable at ${serverUrl}; may tear down with: "npm run testcontainers:down"`,
    );
}

// Mutates the testConfig singleton in place so the rest of globalSetup (same process) sees the
// real resolved values immediately — the generated env file (resetEnvFile) is what hands these
// same values to worker processes.
function applyResolvedConfig(stack: StartedStack): void {
    testConfig.baseURL = resolveUrl(stack.mattermost, MATTERMOST_PORT, MATTERMOST_ALIAS);
    testConfig.smtpURL = resolveUrl(stack.inbucket, INBUCKET_WEB_PORT, INBUCKET_ALIAS);
    testConfig.postgresUrl = resolvePostgresUrl(stack.postgres);
    testConfig.webhookBaseUrl = resolveUrl(stack.webhook, WEBHOOK_PORT, WEBHOOK_ALIAS);
    testConfig.testcontainersNetworkName = stack.network.getName();
    testConfig.mattermostContainerId = stack.mattermost.getId();

    if (stack.additional.openldap) {
        const [host, port] = resolveHostAndPort(stack.additional.openldap, OPENLDAP_PORT, OPENLDAP_ALIAS);
        testConfig.ldapHost = host;
        testConfig.ldapPort = port;
    }
    if (stack.additional.keycloak) {
        testConfig.keycloakUrl = resolveUrl(stack.additional.keycloak, KEYCLOAK_PORT, KEYCLOAK_ALIAS);
    }
    if (stack.additional.elasticsearch) {
        testConfig.elasticsearchUrl = resolveUrl(
            stack.additional.elasticsearch,
            ELASTICSEARCH_PORT,
            ELASTICSEARCH_ALIAS,
        );
    }
    if (stack.additional.opensearch) {
        testConfig.opensearchUrl = resolveUrl(stack.additional.opensearch, OPENSEARCH_PORT, OPENSEARCH_ALIAS);
    }
    if (stack.additional.minio) {
        testConfig.minioUrl = resolveUrl(stack.additional.minio, MINIO_PORT, MINIO_ALIAS);
    }
    if (stack.additional.azurite) {
        testConfig.azuriteUrl = resolveUrl(stack.additional.azurite, AZURITE_BLOB_PORT, AZURITE_ALIAS);
    }
}

// One block per write: a human-readable `# [timestamp] label` comment line (dotenv ignores
// `#`-led lines) followed by the current resolved KEY=VALUE state, including bootEnvOverrides
// JSON-encoded and single-quoted so its embedded double quotes/braces survive dotenv's parser.
function envFileLines(label: string): string[] {
    return [
        `# [${new Date().toISOString()}] ${label}`,
        `PW_BASE_URL=${testConfig.baseURL}`,
        `PW_SMTP_URL=${testConfig.smtpURL}`,
        `PW_POSTGRES_URL=${testConfig.postgresUrl}`,
        `PW_WEBHOOK_BASE_URL=${testConfig.webhookBaseUrl}`,
        `PW_TESTCONTAINERS_NETWORK_GATEWAY_IP=${testConfig.testcontainersNetworkGatewayIp}`,
        `PW_LDAP_HOST=${testConfig.ldapHost}`,
        `PW_LDAP_PORT=${testConfig.ldapPort}`,
        `PW_KEYCLOAK_URL=${testConfig.keycloakUrl}`,
        `PW_ELASTICSEARCH_URL=${testConfig.elasticsearchUrl}`,
        `PW_OPENSEARCH_URL=${testConfig.opensearchUrl}`,
        `PW_MINIO_URL=${testConfig.minioUrl}`,
        `PW_AZURITE_URL=${testConfig.azuriteUrl}`,
        `PW_TESTCONTAINERS_NETWORK_NAME=${testConfig.testcontainersNetworkName}`,
        `PW_TESTCONTAINERS_MATTERMOST_CONTAINER_ID=${testConfig.mattermostContainerId}`,
        `PW_TESTCONTAINERS_BOOT_ENV='${JSON.stringify(testConfig.bootEnvOverrides)}'`,
        '',
    ];
}

// (Re)creates .env.testcontainers from scratch — only called once, when a brand new stack boots,
// so a leftover file from an earlier (now-dead) stack never bleeds into this one.
function resetEnvFile(label: string): void {
    fs.writeFileSync(ENV_FILE_PATH, envFileLines(label).join('\n') + '\n', 'utf-8');
}

/**
 * Appends a new snapshot block instead of overwriting — dotenv resolves the correct current value
 * per key when a fresh process parses the file (later occurrences win), while the file as a whole
 * becomes a chronological log of every restart: which spec/test triggered it, what env diff was
 * requested, and the full resolved state right after. That's what's needed to investigate
 * server-state drift after the fact, since in the CI dispatch model no single process ever sees
 * the whole picture on its own.
 */
function appendEnvFile(label: string): void {
    fs.appendFileSync(ENV_FILE_PATH, envFileLines(label).join('\n') + '\n', 'utf-8');
}

// Preserves the full restart history as a debug artifact before it's deleted — logs/ is already
// what CI's upload-debug-artifacts step picks up, so this needs no separate wiring.
function archiveEnvFile(): void {
    if (!fs.existsSync(ENV_FILE_PATH)) {
        return;
    }
    fs.mkdirSync(LOG_DIR, {recursive: true});
    fs.copyFileSync(ENV_FILE_PATH, path.join(LOG_DIR, 'testcontainers_env_history.log'));
}

function removeEnvFile(): void {
    if (fs.existsSync(ENV_FILE_PATH)) {
        fs.rmSync(ENV_FILE_PATH);
    }
}

async function collectLogs(stack: StartedStack): Promise<void> {
    fs.mkdirSync(LOG_DIR, {recursive: true});

    const targets: Array<[string, StartedTestContainer]> = [
        ['mattermost', stack.mattermost],
        ['postgres', stack.postgres],
        ['inbucket', stack.inbucket],
        ['webhook', stack.webhook],
        ...Object.entries(stack.additional).filter(
            (entry): entry is [string, StartedTestContainer] => entry[1] !== undefined,
        ),
    ];

    await Promise.allSettled(
        targets.map(async ([name, container]) => {
            const logStream = await container.logs();
            const outFile = fs.createWriteStream(path.join(LOG_DIR, `${name}.log`));
            await new Promise<void>((resolve, reject) => {
                logStream.pipe(outFile);
                // Don't let a stalled log stream hold up teardown indefinitely.
                const timer = setTimeout(() => {
                    outFile.end();
                    resolve();
                }, 10_000);
                logStream.on('end', () => {
                    clearTimeout(timer);
                    resolve();
                });
                logStream.on('error', (error) => {
                    clearTimeout(timer);
                    reject(error);
                });
            });
        }),
    );
}
