// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

import {Command} from 'commander';

import {DEFAULT_OUTPUT_DIR} from '@/config';
import {containerExists, listNetworksByLabel, log, removeContainer, removeNetwork, stopContainer} from '@/utils';

import type {DockerInfo, ContainerInfo} from '../types';
import {validateOutputDir} from '../utils';

interface RmOptions {
    outputDir: string;
    yes?: boolean;
}

/**
 * Prompt user for confirmation.
 */
async function confirm(message: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(`${message} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

/**
 * Register the rm command on the program.
 */
export function registerRmCommand(program: Command): Command {
    const rmCommand = program
        .command('rm')
        .description('Stop and remove containers from current session')
        .argument('[command]', 'Use "help" to show help')
        .option('-o, --output-dir <dir>', 'Output directory containing .tc.docker.json', DEFAULT_OUTPUT_DIR)
        .option('-y, --yes', 'Skip confirmation prompt')
        .action(async (command, options: RmOptions) => {
            // Handle "mattermost-testcontainers rm help"
            if (command === 'help') {
                rmCommand.help();
                return;
            }

            await executeRmCommand(options);
        });

    return rmCommand;
}

/**
 * Execute the rm command logic.
 */
async function executeRmCommand(options: RmOptions): Promise<void> {
    try {
        const dockerInfoPath = path.join(options.outputDir, '.tc.docker.json');
        if (!fs.existsSync(dockerInfoPath)) {
            log('No container info found. Nothing to remove.');
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

        // Show what will be removed
        log('');
        log('The following will be removed:');
        log('==============================');
        log(`Containers (${containers.length}):`);
        for (const [key, info] of containers) {
            log(`  - ${key}`);
            if (info.name && info.name !== key) {
                log(`    Name: ${info.name}`);
            }
            log(`    Image: ${info.image}`);
            log(`    ID: ${info.id}`);
        }
        log('');
        log(`Output directory: ${options.outputDir}`);
        log('');

        // Ask for confirmation unless --yes is provided
        if (!options.yes) {
            const confirmed = await confirm('Are you sure you want to remove these resources?');
            if (!confirmed) {
                log('Aborted.');
                return;
            }
        }

        // Stop and remove containers
        const removedContainers: string[] = [];
        for (const [name, info] of containers) {
            try {
                if (containerExists(info.id)) {
                    // Stop container if running
                    try {
                        stopContainer(info.id);
                    } catch {
                        // Container might already be stopped
                    }

                    // Remove container
                    removeContainer(info.id);
                    removedContainers.push(name);
                }
            } catch {
                // Container doesn't exist or already removed
            }
        }

        if (removedContainers.length > 0) {
            log(`✓ Removed ${removedContainers.length} container(s): ${removedContainers.join(', ')}`);
        }

        // Find and remove testcontainers networks
        let networksRemoved = 0;
        const networks = listNetworksByLabel('org.testcontainers=true');
        for (const network of networks) {
            try {
                removeNetwork(network);
                networksRemoved++;
            } catch {
                // Network might be in use
            }
        }

        if (networksRemoved > 0) {
            log(`✓ Removed ${networksRemoved} network(s)`);
        }

        // Remove the output directory
        validateOutputDir(options.outputDir);
        if (fs.existsSync(options.outputDir)) {
            fs.rmSync(options.outputDir, {recursive: true, force: true});
            log(`✓ Removed output directory: ${options.outputDir}`);
        }

        log('✓ Session removed');
    } catch (error) {
        log(`Failed to remove containers: ${error}`);
        process.exit(1);
    }
}
