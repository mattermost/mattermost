// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    MattermostTestEnvironment,
    DependencyConnectionInfo,
    MmctlClient,
    discoverAndLoadConfig,
    setOutputDir,
    printConnectionInfo,
    type ResolvedTestcontainersConfig,
} from '@mattermost/testcontainers';

let environment: MattermostTestEnvironment | null = null;
let resolvedConfig: ResolvedTestcontainersConfig | null = null;

/**
 * Check if testcontainers is enabled via environment variables.
 * Testcontainers is enabled when PW_TC=true.
 */
function isTestcontainersEnabled(): boolean {
    return process.env.PW_TC === 'true';
}

/**
 * Start the Mattermost test environment with containers.
 *
 * Automatically discovers and loads mm-tc.config.mjs from the project root.
 * Configuration priority: environment variables > config file > defaults.
 *
 * Returns null if testcontainers is not enabled (PW_TC=true).
 * When enabled, also sets process.env.PW_BASE_URL to the server URL.
 *
 * @returns The started environment, or null if testcontainers is not enabled
 *
 * @example
 * // In global-setup.ts
 * import {startTestEnvironment} from '@mattermost/playwright-lib';
 *
 * export default async function globalSetup() {
 *     await startTestEnvironment();
 * }
 */
export async function startTestEnvironment(): Promise<MattermostTestEnvironment | null> {
    // Check if testcontainers is enabled
    if (!isTestcontainersEnabled()) {
        return null;
    }

    if (environment) {
        return environment;
    }

    // Auto-discover and load configuration
    resolvedConfig = await discoverAndLoadConfig();

    // Set the output directory for all testcontainers artifacts (logs, .env.tc, etc.)
    setOutputDir(resolvedConfig.outputDir);

    // Create environment with resolved config
    // MattermostTestEnvironment handles serverEnv with proper priority:
    // defaults (serviceEnvironment) < MM_* env vars < user serverEnv
    environment = new MattermostTestEnvironment(resolvedConfig);
    await environment.start();

    // Print connection info
    const info = environment.getConnectionInfo();
    printConnectionInfo(info);

    // Set PW_BASE_URL for Playwright
    const serverUrl = environment.getServerUrl();
    process.env.PW_BASE_URL = serverUrl;

    return environment;
}

/**
 * Stop the Mattermost test environment.
 * This should be called in global-teardown.ts.
 *
 * @example
 * // In global-teardown.ts
 * import {stopTestEnvironment} from '@mattermost/playwright-lib';
 *
 * export default async function globalTeardown() {
 *     await stopTestEnvironment();
 * }
 */
export async function stopTestEnvironment(): Promise<void> {
    if (environment) {
        await environment.stop();
        environment = null;
        resolvedConfig = null;
    }
}

/**
 * Get the MmctlClient for executing mmctl commands.
 * Throws if environment is not started or in local mode.
 *
 * @example
 * const mmctl = getMmctl();
 * await mmctl.exec('user create --email test@test.com --username testuser --password Test123!');
 */
export function getMmctl(): MmctlClient {
    if (!environment) {
        throw new Error('Test environment not started. Call startTestEnvironment() first.');
    }
    return environment.getMmctl();
}

/**
 * Get the Mattermost server URL.
 * Works for both container and local modes.
 */
export function getServerUrl(): string {
    if (!environment) {
        return process.env.PW_BASE_URL || 'http://localhost:8065';
    }
    return environment.getServerUrl();
}

/**
 * Get all service connection information.
 * Useful for configuring test clients or debugging.
 */
export function getConnectionInfo(): DependencyConnectionInfo | null {
    if (!environment) {
        return null;
    }
    return environment.getConnectionInfo();
}

// Re-export types for convenience
export type {DependencyConnectionInfo, MmctlClient, ResolvedTestcontainersConfig};
export {MattermostTestEnvironment};
