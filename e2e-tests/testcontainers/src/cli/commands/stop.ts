// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {Command} from 'commander';

import {DEFAULT_OUTPUT_DIR} from '@/config';
import {isContainerRunning, log, stopContainer} from '@/utils';

import type {DockerInfo, ContainerInfo, OutputDirOptions} from '../types';

/**
 * Register the stop command on the program.
 */
export function registerStopCommand(program: Command): Command {
    const stopCommand = program
        .command('stop')
        .description('Stop containers from current session')
        .argument('[command]', 'Use "help" to show help')
        .option('-o, --output-dir <dir>', 'Output directory containing .tc.docker.json', DEFAULT_OUTPUT_DIR)
        .action(async (command, options: OutputDirOptions) => {
            // Handle "npx @mattermost/testcontainers stop help"
            if (command === 'help') {
                stopCommand.help();
                return;
            }

            await executeStopCommand(options);
        });

    return stopCommand;
}

/**
 * Execute the stop command logic.
 */
async function executeStopCommand(options: OutputDirOptions): Promise<void> {
    try {
        const dockerInfoPath = path.join(options.outputDir, '.tc.docker.json');
        if (!fs.existsSync(dockerInfoPath)) {
            log('No container info found. Nothing to stop.');
            return;
        }

        const dockerInfoRaw = fs.readFileSync(dockerInfoPath, 'utf-8');
        const dockerInfo = JSON.parse(dockerInfoRaw) as DockerInfo;

        // Get all containers from docker info
        const containers = Object.entries(dockerInfo.containers).filter(
            (entry): entry is [string, ContainerInfo] => entry[1] !== undefined,
        );

        if (containers.length === 0) {
            log('No containers found.');
            return;
        }

        // Stop containers
        const stoppedContainers: string[] = [];
        for (const [name, info] of containers) {
            try {
                if (isContainerRunning(info.id)) {
                    stopContainer(info.id);
                    stoppedContainers.push(name);
                }
            } catch {
                // Container doesn't exist or already stopped
            }
        }

        if (stoppedContainers.length > 0) {
            log(`✓ Stopped ${stoppedContainers.length} container(s): ${stoppedContainers.join(', ')}`);
        } else {
            log('No running containers to stop');
        }
    } catch (error) {
        log(`Failed to stop containers: ${error}`);
        process.exit(1);
    }
}
