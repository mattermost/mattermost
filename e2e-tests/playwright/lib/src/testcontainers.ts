// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MattermostTestEnvironment, discoverAndLoadConfig} from '@mattermost/testcontainers';

let environment: MattermostTestEnvironment | null = null;

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
    if (!isTestcontainersEnabled()) {
        return null;
    }

    if (environment) {
        return environment;
    }

    const config = await discoverAndLoadConfig();
    environment = new MattermostTestEnvironment(config);
    await environment.start();
    environment.printConnectionInfo();

    process.env.PW_BASE_URL = environment.getServerUrl();

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
    }
}
