// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {spawn} from 'child_process';

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getMattermostImage, INTERNAL_PORTS} from '@/config';
import type {
    MattermostConnectionInfo,
    MattermostNodeConnectionInfo,
    PostgresConnectionInfo,
    InbucketConnectionInfo,
} from '@/config';
import {formatElapsed} from '@/environment/types';
import {createFileLogConsumer, getImageCreatedDate, log} from '@/utils';

// Default max age for images before forcing a pull (24 hours in milliseconds)
const DEFAULT_IMAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Check if a Docker image exists locally and get its creation timestamp.
 * @returns The image creation date, or null if image doesn't exist locally.
 */
function getLocalImageCreatedDate(imageName: string): Date | null {
    return getImageCreatedDate(imageName);
}

/**
 * Pull a Docker image using docker CLI.
 * Mattermost images are only published for linux/amd64.
 * Shows progress every 5 seconds while pulling.
 * @param imageName The full image name including tag
 */
async function pullImage(imageName: string): Promise<void> {
    log(`Pulling image ${imageName} (platform: linux/amd64)`);
    const pullStart = Date.now();

    // Log progress every 5 seconds while pulling
    const progressInterval = setInterval(() => {
        const elapsed = formatElapsed(Date.now() - pullStart);
        log(`Still pulling ${imageName} (${elapsed})`);
    }, 5000);

    try {
        await new Promise<void>((resolve, reject) => {
            // Mattermost images are only published for linux/amd64
            const proc = spawn('docker', ['pull', '--platform', 'linux/amd64', imageName], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`docker pull exited with code ${code}`));
                }
            });

            proc.on('error', (err) => {
                reject(err);
            });
        });

        clearInterval(progressInterval);
        const elapsed = formatElapsed(Date.now() - pullStart);
        log(`✓ Image ${imageName} pulled (${elapsed})`);
    } catch (error) {
        clearInterval(progressInterval);
        throw new Error(`Failed to pull image ${imageName}: ${error}`);
    }
}

/**
 * Determine if an image should be pulled and pull it if needed.
 * - Always pull if image doesn't exist locally
 * - For :master tag, pull if older than maxAgeMs
 * - For other tags, use default policy (already exists = don't pull)
 *
 * @param imageName The full image name including tag
 * @param maxAgeMs Maximum age in milliseconds before forcing a pull (default: 24 hours)
 */
async function ensureImageAvailable(imageName: string, maxAgeMs: number = DEFAULT_IMAGE_MAX_AGE_MS): Promise<void> {
    const createdDate = getLocalImageCreatedDate(imageName);

    // Image doesn't exist locally - pull it
    if (!createdDate) {
        log(`Image ${imageName} not found locally`);
        await pullImage(imageName);
        return;
    }

    // Only apply age-based pulling for Mattermost :master tag
    const isMattermostMaster = imageName.includes('mattermost') && imageName.endsWith(':master');

    if (!isMattermostMaster) {
        // For other images, don't force pull (image exists)
        return;
    }

    // Check age for :master tag
    const ageMs = Date.now() - createdDate.getTime();
    const shouldPull = ageMs > maxAgeMs;

    if (shouldPull) {
        const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1);
        const maxAgeHours = (maxAgeMs / (60 * 60 * 1000)).toFixed(1);
        log(`Image ${imageName} is ${ageHours}h old (max: ${maxAgeHours}h)`);
        await pullImage(imageName);
    }
}

export interface MattermostConfig {
    image?: string;
    envOverrides?: Record<string, string>;
    /**
     * Maximum age for the image before forcing a pull (in milliseconds).
     * Only applies to Mattermost images with :master tag.
     * Default: 24 hours. Set to 0 to always pull, or Infinity to never force pull.
     */
    imageMaxAgeMs?: number;
    /**
     * Additional files to copy into the container.
     * Useful for SAML certificates, custom config files, etc.
     */
    filesToCopy?: Array<{content: string; target: string}>;
    /**
     * Cluster configuration for HA mode.
     * When provided, the container will be configured as a cluster node.
     */
    cluster?: {
        /** Whether clustering is enabled */
        enable: boolean;
        /** Cluster name */
        clusterName: string;
        /** Node name (e.g., 'leader', 'follower', 'follower2') */
        nodeName: string;
        /** Network alias for this node */
        networkAlias: string;
    };
    /**
     * Subpath for the server (e.g., '/mattermost1').
     * When set, the health check URL is adjusted to include the subpath.
     */
    subpath?: string;
}

export interface MattermostDependencies {
    postgres: PostgresConnectionInfo;
    inbucket?: InbucketConnectionInfo;
    postgresNetworkAlias?: string;
    inbucketNetworkAlias?: string;
}

export function buildMattermostEnv(
    deps: MattermostDependencies,
    config: MattermostConfig,
    processEnv: Record<string, string | undefined> = process.env,
): Record<string, string> {
    // Build internal connection string (container-to-container via network alias)
    const pgAlias = deps.postgresNetworkAlias ?? 'postgres';
    const internalDbUrl = `postgres://${deps.postgres.username}:${deps.postgres.password}@${pgAlias}:${INTERNAL_PORTS.postgres}/${deps.postgres.database}?sslmode=disable`;

    const env: Record<string, string> = {
        // Database configuration (using MM_CONFIG for database-driven config)
        MM_CONFIG: internalDbUrl,
        MM_SQLSETTINGS_DRIVERNAME: 'postgres',
        MM_SQLSETTINGS_DATASOURCE: internalDbUrl,

        // Server settings (required for container operation)
        // Note: SiteURL is set via mmctl after container starts to use the actual mapped port
        // Note: Other settings are set via mmctl so they can be changed in System Console
        MM_SERVICESETTINGS_LISTENADDRESS: `:${INTERNAL_PORTS.mattermost}`,

        // Allow config changes via System Console (must be set via env var, not mmctl)
        MM_CLUSTERSETTINGS_READONLYCONFIG: 'false',
    };

    // Configure email if inbucket is available (required settings only)
    // Other email settings are applied via mmctl after server starts
    if (deps.inbucket) {
        const inbucketAlias = deps.inbucketNetworkAlias ?? 'inbucket';
        env.MM_EMAILSETTINGS_SMTPSERVER = inbucketAlias;
        env.MM_EMAILSETTINGS_SMTPPORT = String(INTERNAL_PORTS.inbucket.smtp);
    }

    // Add license if provided via environment variable (skip for team edition or entry tier)
    const edition = processEnv.TC_EDITION?.toLowerCase();
    const entry = processEnv.TC_ENTRY?.toLowerCase() === 'true';
    if (processEnv.MM_LICENSE && edition !== 'team' && !entry) {
        env.MM_LICENSE = processEnv.MM_LICENSE;
    }

    // Configure cluster settings for HA mode
    if (config.cluster?.enable) {
        env.MM_CLUSTERSETTINGS_ENABLE = 'true';
        env.MM_CLUSTERSETTINGS_CLUSTERNAME = config.cluster.clusterName;
        // Use the node name for log file location to separate logs
        env.MM_LOGSETTINGS_FILELOCATION = `./logs/${config.cluster.nodeName}`;
    }

    // Apply user overrides
    if (config.envOverrides) {
        Object.assign(env, config.envOverrides);
    }

    return env;
}

export async function createMattermostContainer(
    network: StartedNetwork,
    deps: MattermostDependencies,
    config: MattermostConfig = {},
): Promise<StartedTestContainer> {
    const image = config.image ?? getMattermostImage();
    const env = buildMattermostEnv(deps, config);
    const maxAgeMs = config.imageMaxAgeMs ?? DEFAULT_IMAGE_MAX_AGE_MS;

    // Ensure image is available (pull if needed)
    await ensureImageAvailable(image, maxAgeMs);

    // Determine network alias - use cluster node alias or default to 'mattermost'
    const networkAlias = config.cluster?.networkAlias ?? 'mattermost';
    const logName = config.cluster?.nodeName ? `mattermost-${config.cluster.nodeName}` : 'mattermost';

    // Health check URL - include subpath if configured
    const healthCheckPath = config.subpath ? `${config.subpath}/api/v4/system/ping` : '/api/v4/system/ping';

    // Build health check wait strategy.
    // When subpath is configured, we MUST verify the response body contains the actual ping JSON.
    // Without this check, the SPA catch-all returns HTTP 200 with HTML for any path,
    // causing false positive health checks even when the subpath routing isn't working.
    const healthCheck = Wait.forHttp(healthCheckPath, INTERNAL_PORTS.mattermost).withStartupTimeout(60_000);
    if (config.subpath) {
        healthCheck.forResponsePredicate((response) => response.includes('"status":"OK"'));
    }

    // Mattermost images are only published for linux/amd64
    let containerBuilder = new GenericContainer(image)
        .withPlatform('linux/amd64')
        .withNetwork(network)
        .withNetworkAliases(networkAlias)
        .withEnvironment(env)
        .withExposedPorts(INTERNAL_PORTS.mattermost)
        .withLogConsumer(createFileLogConsumer(logName))
        .withWaitStrategy(healthCheck);

    // Copy any additional files (e.g., SAML certificates)
    if (config.filesToCopy && config.filesToCopy.length > 0) {
        containerBuilder = containerBuilder.withCopyContentToContainer(config.filesToCopy);
    }

    const container = await containerBuilder.start();

    return container;
}

export function getMattermostConnectionInfo(container: StartedTestContainer, image: string): MattermostConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.mattermost);

    return {
        host,
        port,
        url: `http://${host}:${port}`,
        internalUrl: `http://mattermost:${INTERNAL_PORTS.mattermost}`,
        image,
    };
}

/**
 * Get connection info for a Mattermost cluster node in HA mode.
 */
export function getMattermostNodeConnectionInfo(
    container: StartedTestContainer,
    image: string,
    nodeName: string,
    networkAlias: string,
): MattermostNodeConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.mattermost);

    return {
        host,
        port,
        url: `http://${host}:${port}`,
        internalUrl: `http://${networkAlias}:${INTERNAL_PORTS.mattermost}`,
        image,
        nodeName,
        networkAlias,
    };
}

/**
 * Generate node names for HA cluster.
 * Returns ['leader', 'follower', 'follower2'] for 3 nodes, etc.
 */
export function generateNodeNames(nodeCount: number): string[] {
    const names: string[] = ['leader'];
    for (let i = 1; i < nodeCount; i++) {
        names.push(i === 1 ? 'follower' : `follower${i}`);
    }
    return names;
}
