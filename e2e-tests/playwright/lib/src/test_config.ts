// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as dotenv from 'dotenv';

import {MATTERMOST_ALIAS, MATTERMOST_PORT, WEBHOOK_ALIAS, WEBHOOK_PORT} from './containers/constants';
import {MATTERMOST_SERVER_IMAGE} from './containers/default_images';
import {SERVER_ENV_BASELINE} from './containers/env_baseline';

dotenv.config({quiet: true});
dotenv.config({path: '.env.testcontainers', quiet: true, override: true});

// The set of additional services `testcontainers` mode knows how to start.
// Single source of truth for `requirements.ts` and for validating PW_TESTCONTAINERS_SERVICES.
export const TESTCONTAINERS_SERVICE_NAMES = [
    'openldap',
    'keycloak',
    'elasticsearch',
    'opensearch',
    'minio',
    'azurite',
] as const;
export type TestContainersServiceName = (typeof TESTCONTAINERS_SERVICE_NAMES)[number];

// Started whenever PW_TESTCONTAINERS_SERVICES is unset.
// On older release branches CI leaves this empty; opt in per-service as needed.
const DEFAULT_TESTCONTAINERS_SERVICES: TestContainersServiceName[] = [];

// All process.env should be defined here
export class TestConfig {
    baseURL: string;
    adminUsername: string;
    adminPassword: string;
    adminEmail: string;
    ensurePluginsInstalled: string[];
    haClusterEnabled: boolean;
    haClusterNodeCount: number;
    haClusterName: string;
    pushNotificationServer: string;
    resetBeforeTest: boolean;
    isCI: boolean;
    headless: boolean;
    slowMo: number;
    workers: number;
    snapshotEnabled: boolean;
    percyEnabled: boolean;
    smtpURL: string;
    /**
     * Postgres connection string for specs needing direct DB access to bypass API-level
     * validation. In `testcontainers` mode the default port is a placeholder — startStack() overwrites
     * it with the actual Testcontainers-assigned host-mapped port once the container is up.
     */
    postgresUrl: string;

    /** Base URL of the Cypress/Playwright webhook sidecar (`e2e-tests/cypress`: `npm run start:webhook`). */
    webhookBaseUrl: string;
    /**
     * How OTHER containers (not the test process) reach Mattermost — used when a URL is embedded
     * in a request body the server itself later dereferences (e.g. a webhook callback URL). In
     * `external` mode this equals baseURL. In `testcontainers` mode it's the fixed Docker network alias,
     * since a container can't reach another container's host-mapped port via `localhost`.
     */
    internalBaseURL: string;
    /** Same distinction as internalBaseURL, for the webhook sidecar's own address. */
    webhookInternalUrl: string;
    /**
     * Gateway IP (e.g. 172.18.0.1) of the Testcontainers bridge network in `testcontainers` mode — an
     * address on the Docker host itself, reachable both from the browser and from inside the
     * Mattermost container, so a single mock file server URL works for both without a network
     * alias or mapped port. Empty in `external` mode, where plain localhost already works for
     * both since neither runs in a container.
     */
    testcontainersNetworkGatewayIp: string;

    // Testcontainers (`testcontainers` mode)

    /** Selects `testcontainers` mode (Testcontainers manages the server + dependencies) over `external` mode (default). */
    useTestContainers: boolean;
    /** Prebuilt Mattermost server image `testcontainers` mode starts. Same env var Compose-based CI already uses. */
    serverImage: string;
    /** Arbitrary MM_* config overrides merged over the test-oriented baseline, comma-separated KEY=VALUE pairs. */
    serverEnv: Record<string, string>;
    /**
     * Which additional services `testcontainers` mode starts, validated against
     * `TESTCONTAINERS_SERVICE_NAMES`. Defaults to `DEFAULT_TESTCONTAINERS_SERVICES` when
     * PW_TESTCONTAINERS_SERVICES is unset; set it to an empty string to start none.
     */
    testcontainersServices: TestContainersServiceName[];
    /** Reuse containers across repeated local `testcontainers`-mode runs instead of recreating them every time. */
    testcontainersReuse: boolean;
    /** Playwright itself runs inside a container (e.g. CI); join it to the Testcontainers network instead of using mapped ports. */
    containerRunner: boolean;
    /**
     * Name of the Docker network the stack runs on. getNetwork()'s in-process cache only helps
     * within the process that called startStack() (global setup) — worker processes need this to
     * join a container (e.g. the mmctl runner) to that same network instead of creating their own.
     */
    testcontainersNetworkName: string;
    /**
     * ID of the currently-running Mattermost container. Global setup and worker processes are
     * separate OS processes — this is how a worker's restartMattermostContainer() (e.g. to switch
     * file storage backends) finds the container to replace without an in-process object handle.
     */
    mattermostContainerId: string;
    /**
     * The full set of env vars the current Mattermost container actually booted with — baseline
     * plus every boot-time-only setting a pw.ensure*() has switched via
     * restartMattermostContainer() so far. Each ensure*() checks this before restarting, so it
     * only restarts when something actually needs to change, and restartMattermostContainer()
     * merges into this record rather than replacing it, so a restart for one setting doesn't
     * undo another restart's change.
     *
     * Persisted to .env.testcontainers and read back rather than recomputed, because a container
     * can outlive the process that booted it (e.g. reused across specs in CI) — a later process
     * must see the server's actual current state, not assume defaults.
     */
    bootEnvOverrides: Record<string, string>;

    /** Used in every mode; defaults match the fixed ports the Testcontainers stack publishes. */
    ldapHost: string;
    ldapPort: number;
    keycloakUrl: string;
    elasticsearchUrl: string;
    opensearchUrl: string;
    minioUrl: string;
    azuriteUrl: string;

    constructor() {
        // Server
        this.baseURL = process.env.PW_BASE_URL || 'http://localhost:8065';
        this.adminUsername = process.env.PW_ADMIN_USERNAME || 'sysadmin';
        this.adminPassword = process.env.PW_ADMIN_PASSWORD || 'Sys@dmin-sample1';
        this.adminEmail = process.env.PW_ADMIN_EMAIL || 'sysadmin@sample.mattermost.com';
        this.ensurePluginsInstalled =
            typeof process.env?.PW_ENSURE_PLUGINS_INSTALLED === 'string'
                ? process.env.PW_ENSURE_PLUGINS_INSTALLED.split(',').filter((plugin) => Boolean(plugin))
                : [];
        this.haClusterEnabled = parseBool(process.env.PW_HA_CLUSTER_ENABLED, false);
        this.haClusterNodeCount = parseNumber(process.env.PW_HA_CLUSTER_NODE_COUNT, 2);
        this.haClusterName = process.env.PW_HA_CLUSTER_NAME || 'mm_dev_cluster';
        this.pushNotificationServer = process.env.PW_PUSH_NOTIFICATION_SERVER || 'https://push-test.mattermost.com';
        this.resetBeforeTest = parseBool(process.env.PW_RESET_BEFORE_TEST, false);
        // CI
        this.isCI = Boolean(process.env.CI);
        // Playwright
        this.headless = parseBool(process.env.PW_HEADLESS, true);
        this.slowMo = parseNumber(process.env.PW_SLOWMO, 0);
        this.workers = parseNumber(process.env.PW_WORKERS, 1);
        // Visual tests
        this.snapshotEnabled = parseBool(process.env.PW_SNAPSHOT_ENABLE, false);
        this.percyEnabled = parseBool(process.env.PW_PERCY_ENABLE, false);
        // Email
        this.smtpURL = process.env.PW_SMTP_URL || 'http://localhost:9001';
        this.postgresUrl =
            process.env.PW_POSTGRES_URL ||
            'postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10&binary_parameters=yes';
        this.webhookBaseUrl = process.env.PW_WEBHOOK_BASE_URL || 'http://localhost:3000';

        // Testcontainers
        this.useTestContainers = parseBool(process.env.PW_USE_TESTCONTAINERS, false);
        // Fixed Docker network aliases, not derived from any started container object — stable
        // across a restartMattermostContainer() call, unlike baseURL's host-mapped port.
        this.internalBaseURL = this.useTestContainers ? `http://${MATTERMOST_ALIAS}:${MATTERMOST_PORT}` : this.baseURL;
        this.webhookInternalUrl = this.useTestContainers
            ? `http://${WEBHOOK_ALIAS}:${WEBHOOK_PORT}`
            : this.webhookBaseUrl;
        this.testcontainersNetworkGatewayIp = process.env.PW_TESTCONTAINERS_NETWORK_GATEWAY_IP || '';
        this.serverImage = process.env.SERVER_IMAGE || MATTERMOST_SERVER_IMAGE;
        this.serverEnv = parseKeyValueList(process.env.MM_ENV);
        this.testcontainersServices = parseTestContainersServices(process.env.PW_TESTCONTAINERS_SERVICES);
        // Defaults to true so a local Ctrl+C (or just finishing a run) doesn't throw away the
        // stack you were likely about to inspect — tear down explicitly with `npm run testcontainers:down`.
        this.testcontainersReuse = parseBool(process.env.PW_TESTCONTAINERS_REUSE, true);
        this.containerRunner = parseBool(process.env.PW_TESTCONTAINERS_CONTAINER_RUNNER, false);
        this.testcontainersNetworkName = process.env.PW_TESTCONTAINERS_NETWORK_NAME || '';
        this.mattermostContainerId = process.env.PW_TESTCONTAINERS_MATTERMOST_CONTAINER_ID || '';
        // Prefer a previously-persisted boot env, since it reflects the container's actual
        // current state; only compute the default when it's genuinely absent (first boot). A
        // stale file pointing at a container that's no longer running is detected and reset
        // elsewhere, before a fresh container starts.
        this.bootEnvOverrides =
            parsePersistedBootEnv(process.env.PW_TESTCONTAINERS_BOOT_ENV) ?? computeDefaultBootEnv(this.serverEnv);
        this.ldapHost = process.env.PW_LDAP_HOST || 'localhost';
        this.ldapPort = parseNumber(process.env.PW_LDAP_PORT, 389);
        this.keycloakUrl = process.env.PW_KEYCLOAK_URL || 'http://localhost:8484';
        this.elasticsearchUrl = process.env.PW_ELASTICSEARCH_URL || 'http://localhost:9200';
        this.opensearchUrl = process.env.PW_OPENSEARCH_URL || 'http://localhost:9201';
        this.minioUrl = process.env.PW_MINIO_URL || 'http://localhost:9000';
        this.azuriteUrl = process.env.PW_AZURITE_URL || 'http://localhost:10000';
    }
}

// Create a singleton instance
export const testConfig = new TestConfig();

/**
 * Resolve a path against the live server URL. Playwright's config `baseURL` is fixed when the
 * worker starts; after `restartMattermostContainer()` remaps the host port, relative `page.goto`
 * calls would still hit the stale port unless they go through this helper (or an absolute URL).
 */
export function resolveAppUrl(pathOrUrl: string): string {
    if (/^[a-z][a-z0-9+.-]*:/i.test(pathOrUrl)) {
        return pathOrUrl;
    }
    return new URL(pathOrUrl, testConfig.baseURL).href;
}

function parseBool(actualValue: string | undefined, defaultValue: boolean) {
    return actualValue ? actualValue === 'true' : defaultValue;
}

function parseNumber(actualValue: string | undefined, defaultValue: number) {
    return actualValue ? parseInt(actualValue, 10) : defaultValue;
}

function parseKeyValueList(actualValue: string | undefined): Record<string, string> {
    if (!actualValue) {
        return {};
    }

    const result: Record<string, string> = {};
    for (const entry of actualValue
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)) {
        const separatorIndex = entry.indexOf('=');
        if (separatorIndex === -1) {
            throw new Error(`Invalid MM_ENV entry "${entry}" — expected KEY=VALUE.`);
        }
        result[entry.slice(0, separatorIndex)] = entry.slice(separatorIndex + 1);
    }
    return result;
}

// Mirrors startMattermostContainer()'s actual default boot env: baseline plus MM_ENV overrides
// (same precedence), plus the two settings it never sets itself, so the server falls back to
// its own defaults for those.
function computeDefaultBootEnv(serverEnv: Record<string, string>): Record<string, string> {
    return {
        ...SERVER_ENV_BASELINE,
        MM_FILESETTINGS_DRIVERNAME: 'local',
        MM_ELASTICSEARCHSETTINGS_BACKEND: 'elasticsearch',
        ...serverEnv,
    };
}

/**
 * Boot env a genuinely fresh container starts with. Used to reset bootEnvOverrides when a
 * persisted boot env turns out to reference a container that's no longer running.
 */
export function defaultBootEnv(): Record<string, string> {
    return computeDefaultBootEnv(testConfig.serverEnv);
}

function parsePersistedBootEnv(actualValue: string | undefined): Record<string, string> | undefined {
    if (!actualValue) {
        return undefined;
    }
    try {
        return JSON.parse(actualValue);
    } catch {
        return undefined;
    }
}

function parseTestContainersServices(actualValue: string | undefined): TestContainersServiceName[] {
    if (actualValue === undefined) {
        return DEFAULT_TESTCONTAINERS_SERVICES;
    }

    // An explicit empty string is a deliberate opt-out (e.g. a spec that wants only the core
    // stack), distinct from not setting the var at all.
    if (!actualValue) {
        return [];
    }

    const requested = actualValue.split(',').filter(Boolean);
    const unknown = requested.filter((name) => !(TESTCONTAINERS_SERVICE_NAMES as readonly string[]).includes(name));
    if (unknown.length > 0) {
        throw new Error(
            `Unknown PW_TESTCONTAINERS_SERVICES entr${unknown.length > 1 ? 'ies' : 'y'}: ${unknown.join(', ')}. ` +
                `Valid services are: ${TESTCONTAINERS_SERVICE_NAMES.join(', ')}.`,
        );
    }
    return requested as TestContainersServiceName[];
}
