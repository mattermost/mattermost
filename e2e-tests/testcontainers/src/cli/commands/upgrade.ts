// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {Command} from 'commander';

import {DEFAULT_OUTPUT_DIR} from '../../config/config';
import {log} from '../../utils/log';
import {
    upgradeContainer,
    waitForContainer,
    getServerVersion,
    getServerConfig,
    saveConfigDiff,
} from '../container-utils';
import type {DockerInfo, UpgradeOptions} from '../types';

/**
 * Register the upgrade command on the program.
 */
export function registerUpgradeCommand(program: Command): void {
    program
        .command('upgrade')
        .description('Upgrade Mattermost server(s) to a new image tag (rolling upgrade)')
        .requiredOption('-t, --tag <tag>', 'The new image tag to upgrade to (e.g., release-11.5)')
        .option('-o, --output-dir <dir>', 'Output directory containing .tc.docker.json', DEFAULT_OUTPUT_DIR)
        .action(async (options: UpgradeOptions) => {
            await executeUpgradeCommand(options);
        });
}

/**
 * Execute the upgrade command logic.
 */
async function executeUpgradeCommand(options: UpgradeOptions): Promise<void> {
    const tag = options.tag;
    try {
        const {execSync} = await import('child_process');

        const outputDir = options.outputDir;
        const dockerInfoPath = path.join(outputDir, '.tc.docker.json');
        if (!fs.existsSync(dockerInfoPath)) {
            log(`Error: Docker info file not found: ${dockerInfoPath}`);
            process.exit(1);
        }

        const dockerInfoRaw = fs.readFileSync(dockerInfoPath, 'utf-8');
        const dockerInfo = JSON.parse(dockerInfoRaw) as DockerInfo;

        // Find all Mattermost containers (keys starting with 'mattermost')
        // This handles: single node, HA (mattermost-leader, mattermost-follower),
        // subpath (mattermost-server1, mattermost-server2), and subpath+HA combinations
        const mmContainerKeys = Object.keys(dockerInfo.containers).filter(
            (key) => key === 'mattermost' || key.startsWith('mattermost-'),
        );

        if (mmContainerKeys.length === 0) {
            log('Error: No Mattermost container(s) found in the environment');
            process.exit(1);
        }

        // Get image info from the first container to determine base image
        const firstContainer = dockerInfo.containers[mmContainerKeys[0]]!;
        const currentImage = firstContainer.image;
        const lastColonIndex = currentImage.lastIndexOf(':');
        if (lastColonIndex === -1) {
            log(`Error: Invalid image format: ${currentImage}`);
            process.exit(1);
        }

        const imageBase = currentImage.substring(0, lastColonIndex);
        const currentTag = currentImage.substring(lastColonIndex + 1);
        const newImage = `${imageBase}:${tag}`;

        // Check if already on the same tag
        if (currentTag === tag) {
            log(`Server(s) already running tag: ${tag}`);
            process.exit(0);
        }

        // Get current version from the first accessible container
        let currentVersion = 'unknown';
        for (const key of mmContainerKeys) {
            const info = dockerInfo.containers[key];
            if (info) {
                currentVersion = await getServerVersion(info.url);
                if (currentVersion !== 'unknown') break;
            }
        }

        log(`Upgrading Mattermost from ${currentTag} (v${currentVersion}) to ${tag}`);
        log(`Containers to upgrade: ${mmContainerKeys.join(', ')}`);

        // Get config from all containers before upgrade
        const configsBefore: Map<string, Record<string, unknown> | null> = new Map();
        for (const containerKey of mmContainerKeys) {
            const containerInfo = dockerInfo.containers[containerKey];
            if (!containerInfo) continue;

            log(`Getting config from ${containerKey}...`);
            const configBefore = getServerConfig(execSync, containerInfo.id);
            configsBefore.set(containerKey, configBefore);
        }

        // Pull the new image first (before stopping any containers)
        log(`Pulling image: ${newImage}`);
        try {
            execSync(`docker pull --platform linux/amd64 ${newImage}`, {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            log('Image pulled successfully');
        } catch {
            log(`Error: Failed to pull image: ${newImage}`);
            process.exit(1);
        }

        // Upgrade each Mattermost container
        const upgradedContainers: Array<{
            key: string;
            info: (typeof dockerInfo.containers)[string];
            newContainerId: string;
        }> = [];
        let hasErrors = false;

        for (const containerKey of mmContainerKeys) {
            const containerInfo = dockerInfo.containers[containerKey];
            if (!containerInfo) continue;

            const result = await upgradeContainer(execSync, containerKey, containerInfo, newImage);

            if (result.success && result.newContainerId) {
                upgradedContainers.push({
                    key: containerKey,
                    info: containerInfo,
                    newContainerId: result.newContainerId,
                });
                log(`✓ ${containerKey} upgraded (port ${containerInfo.port})`);
            } else {
                log(`✗ ${containerKey} failed: ${result.error}`);
                hasErrors = true;
            }
        }

        if (upgradedContainers.length === 0) {
            log('Error: No containers were upgraded');
            process.exit(1);
        }

        // Wait for all upgraded containers to be ready
        for (const {key, info, newContainerId} of upgradedContainers) {
            if (!info) continue;
            const url = `http://localhost:${info.port}`;
            const isReady = await waitForContainer(url);
            if (isReady) {
                log(`✓ ${key} ready at http://localhost:${info.port}`);

                // Get config after upgrade and save diff
                const configBefore = configsBefore.get(key) ?? null;
                const configAfter = getServerConfig(execSync, newContainerId);
                saveConfigDiff(outputDir, 'upgrade', configBefore, configAfter);
            } else {
                log(`⚠ ${key} may not be fully ready`);
            }
        }

        // Update docker info file with new container details
        for (const {key, info, newContainerId} of upgradedContainers) {
            if (!info) continue;
            const newContainerName = execSync(`docker inspect --format '{{.Name}}' ${newContainerId}`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            })
                .trim()
                .replace(/^\//, '');

            dockerInfo.containers[key] = {
                ...info,
                id: newContainerId,
                name: newContainerName,
                image: newImage,
            };
        }

        fs.writeFileSync(dockerInfoPath, JSON.stringify(dockerInfo, null, 2) + '\n');

        // Get new version from the first accessible container
        let newVersion = 'unknown';
        for (const {info} of upgradedContainers) {
            if (!info) continue;
            const url = `http://localhost:${info.port}`;
            newVersion = await getServerVersion(url);
            if (newVersion !== 'unknown') break;
        }

        log(`✓ Upgrade completed: v${currentVersion} → v${newVersion}`);

        if (hasErrors) {
            log('Note: Some containers failed to upgrade. Check the errors above.');
            process.exit(1);
        }
    } catch (error) {
        log(`Upgrade failed: ${error}`);
        process.exit(1);
    }
}
