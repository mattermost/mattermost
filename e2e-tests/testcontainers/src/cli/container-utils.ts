// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {log} from '../utils/log';

import type {ContainerInfo} from './types';

/**
 * Upgrade a single Mattermost container to a new image.
 * Preserves the same port, network, and environment configuration.
 */
export async function upgradeContainer(
    execSync: typeof import('child_process').execSync,
    containerKey: string,
    containerInfo: ContainerInfo,
    newImage: string,
): Promise<{success: boolean; newContainerId?: string; error?: string}> {
    const containerId = containerInfo.id;
    const originalPort = containerInfo.port;

    // Check if the container is actually running
    try {
        const status = execSync(`docker inspect --format '{{.State.Running}}' ${containerId}`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();

        if (status !== 'true') {
            return {success: false, error: 'Container is not running'};
        }
    } catch {
        return {success: false, error: 'Container not found'};
    }

    // Get the container configuration before stopping
    let containerConfig: {
        NetworkSettings: {
            Networks: Record<
                string,
                {
                    NetworkID: string;
                    Aliases: string[] | null;
                }
            >;
        };
        Config: {Env: string[]};
    };
    try {
        const inspectResult = execSync(`docker inspect ${containerId}`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        containerConfig = JSON.parse(inspectResult)[0];
    } catch {
        return {success: false, error: 'Failed to inspect container'};
    }

    // Stop the container
    log(`Stopping ${containerKey}...`);
    try {
        execSync(`docker stop ${containerId}`, {stdio: ['pipe', 'pipe', 'pipe']});
    } catch {
        return {success: false, error: 'Failed to stop container'};
    }

    // Remove the stopped container
    try {
        execSync(`docker rm ${containerId}`, {stdio: ['pipe', 'pipe', 'pipe']});
    } catch {
        // Container might already be removed
    }

    // Extract network info - find the testcontainers network (not the default bridge)
    const networkNames = Object.keys(containerConfig.NetworkSettings.Networks);

    // Find the testcontainers network - prefer network with aliases, or non-bridge network
    let selectedNetwork: string | null = null;
    let networkAliases: string[] = [];

    for (const netName of networkNames) {
        const netConfig = containerConfig.NetworkSettings.Networks[netName];
        const aliases = netConfig.Aliases || [];

        // Prefer networks with aliases (testcontainers networks have service aliases)
        if (aliases.length > 0 && netName !== 'bridge') {
            selectedNetwork = netName;
            networkAliases = aliases.filter((alias) => alias !== containerId.substring(0, 12) && alias !== containerId);
            break;
        }

        // If no aliased network found yet, prefer non-bridge networks
        if (!selectedNetwork && netName !== 'bridge') {
            selectedNetwork = netName;
            networkAliases = aliases.filter((alias) => alias !== containerId.substring(0, 12) && alias !== containerId);
        }
    }

    // Fallback to first network if no better option found
    if (!selectedNetwork && networkNames.length > 0) {
        selectedNetwork = networkNames[0];
        const aliases = containerConfig.NetworkSettings.Networks[selectedNetwork].Aliases || [];
        networkAliases = aliases.filter((alias) => alias !== containerId.substring(0, 12) && alias !== containerId);
    }

    // Extract environment variables
    const envVars = containerConfig.Config.Env || [];

    // Build docker run command
    let dockerRunCmd = `docker run -d --platform linux/amd64`;

    // Add network if available (use network name, not ID)
    if (selectedNetwork) {
        dockerRunCmd += ` --network ${selectedNetwork}`;

        // Add network aliases (only valid with user-defined networks)
        for (const alias of networkAliases) {
            dockerRunCmd += ` --network-alias ${alias}`;
        }
    }

    // Add environment variables
    for (const envVar of envVars) {
        // Escape special characters in env values
        const escapedEnvVar = envVar.replace(/"/g, '\\"');
        dockerRunCmd += ` -e "${escapedEnvVar}"`;
    }

    // Add port mapping - use the same host port as the original container
    dockerRunCmd += ` -p ${originalPort}:8065`;

    // Add testcontainers label for cleanup
    dockerRunCmd += ` --label org.testcontainers=true`;

    // Add the new image
    dockerRunCmd += ` ${newImage}`;

    log(`Starting ${containerKey} with new image (port ${originalPort})...`);
    let newContainerId: string;
    try {
        newContainerId = execSync(dockerRunCmd, {encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']}).trim();
    } catch (error) {
        return {success: false, error: `Failed to start container: ${error}`};
    }

    return {success: true, newContainerId};
}

/**
 * Wait for a container to be ready by checking its health endpoint.
 */
export async function waitForContainer(url: string, maxWaitMs: number = 60000): Promise<boolean> {
    const http = await import('http');
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
        try {
            const isReady = await new Promise<boolean>((resolve) => {
                const req = http.get(`${url}/api/v4/system/ping`, (res) => {
                    resolve(res.statusCode === 200);
                });
                req.on('error', () => resolve(false));
                req.setTimeout(5000, () => {
                    req.destroy();
                    resolve(false);
                });
            });

            if (isReady) {
                return true;
            }
        } catch {
            // Server not ready yet
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return false;
}

/**
 * Get the server version from the ping endpoint.
 * Returns just the version number (e.g., "11.4.0") instead of the full version string.
 */
export async function getServerVersion(url: string): Promise<string> {
    try {
        const http = await import('http');
        const fullVersion = await new Promise<string>((resolve) => {
            const req = http.get(`${url}/api/v4/system/ping`, (res) => {
                if (res.headers['x-version-id']) {
                    resolve(res.headers['x-version-id'] as string);
                } else {
                    resolve('unknown');
                }
            });
            req.on('error', () => resolve('unknown'));
            req.setTimeout(5000, () => {
                req.destroy();
                resolve('unknown');
            });
        });

        // Extract just the version number (first part before the first dot-separated build info)
        // Full format: "11.4.0.21550760092.0f2d8b11fcd975de9c2aae2f165176de220a638b3bfaaa4787ccdb95fb5d4a93.true"
        // We want: "11.4.0"
        if (fullVersion !== 'unknown') {
            const parts = fullVersion.split('.');
            if (parts.length >= 3) {
                return `${parts[0]}.${parts[1]}.${parts[2]}`;
            }
        }
        return fullVersion;
    } catch {
        return 'unknown';
    }
}

/**
 * Get server config from a running container using mmctl.
 */
export function getServerConfig(
    execSync: typeof import('child_process').execSync,
    containerId: string,
): Record<string, unknown> | null {
    try {
        const result = execSync(`docker exec ${containerId} mmctl --local config show --json`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return JSON.parse(result);
    } catch {
        return null;
    }
}

/**
 * Deep compare two objects and return paths that differ.
 */
export function findConfigDiffs(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    pathPrefix: string = '',
): Array<{path: string; before: unknown; after: unknown}> {
    const diffs: Array<{path: string; before: unknown; after: unknown}> = [];

    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
        const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        const beforeVal = before[key];
        const afterVal = after[key];

        if (beforeVal === afterVal) {
            continue;
        }

        if (
            typeof beforeVal === 'object' &&
            typeof afterVal === 'object' &&
            beforeVal !== null &&
            afterVal !== null &&
            !Array.isArray(beforeVal) &&
            !Array.isArray(afterVal)
        ) {
            // Recurse into nested objects
            diffs.push(
                ...findConfigDiffs(
                    beforeVal as Record<string, unknown>,
                    afterVal as Record<string, unknown>,
                    currentPath,
                ),
            );
        } else if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
            diffs.push({path: currentPath, before: beforeVal, after: afterVal});
        }
    }

    return diffs;
}

/**
 * Save config diff files for an operation (restart, upgrade, etc.).
 * - Saves before config to `.tc.before.{operation}.server.config.json`
 * - Updates `.tc.server.config.json` with after config
 * - Generates `.tc.diff.{operation}.server.config.jsonc` with comments showing previous values
 */
export function saveConfigDiff(
    outputDir: string,
    operation: string,
    beforeConfig: Record<string, unknown> | null,
    afterConfig: Record<string, unknown> | null,
): void {
    // Save before config with fixed name
    if (beforeConfig) {
        const beforePath = path.join(outputDir, `.tc.before.${operation}.server.config.json`);
        fs.writeFileSync(beforePath, JSON.stringify(beforeConfig, null, 2) + '\n');
    }

    // Update the main server config file
    if (afterConfig) {
        const serverConfigPath = path.join(outputDir, '.tc.server.config.json');
        fs.writeFileSync(serverConfigPath, JSON.stringify(afterConfig, null, 2) + '\n');
    }

    // Generate and save diff if both configs exist
    if (beforeConfig && afterConfig) {
        const diffs = findConfigDiffs(beforeConfig, afterConfig);
        const diffPath = path.join(outputDir, `.tc.diff.${operation}.server.config.jsonc`);

        if (diffs.length > 0) {
            log(`Found ${diffs.length} config difference(s)`);
            const jsoncContent = generateDiffOnlyConfig(operation, diffs);
            fs.writeFileSync(diffPath, jsoncContent + '\n');
        } else {
            const content = `// No configuration differences found after ${operation}\n{}`;
            fs.writeFileSync(diffPath, content + '\n');
            log('No config differences found');
        }
    }
}

/**
 * Generate JSONC content showing only the differences with previous values as comments.
 */
function generateDiffOnlyConfig(
    operation: string,
    diffs: Array<{path: string; before: unknown; after: unknown}>,
): string {
    const lines: string[] = [];
    lines.push(`// Configuration differences after ${operation}`);
    lines.push('// Format: "path": <new_value> // Previous: <old_value>');
    lines.push('{');

    for (let i = 0; i < diffs.length; i++) {
        const diff = diffs[i];
        const afterStr = JSON.stringify(diff.after);
        const beforeStr = JSON.stringify(diff.before);
        const comma = i < diffs.length - 1 ? ',' : '';
        lines.push(`  "${diff.path}": ${afterStr}${comma} // Previous: ${beforeStr}`);
    }

    lines.push('}');
    return lines.join('\n');
}
