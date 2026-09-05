// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as readline from 'readline';

import {Command} from 'commander';

import {DEFAULT_OUTPUT_DIR} from '@/config';
import {
    getContainerImage,
    getContainerName,
    listContainersByLabel,
    listNetworksByLabel,
    log,
    removeContainer,
    removeNetwork,
    stopContainer,
} from '@/utils';

import {validateOutputDir} from '../utils';

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

interface RmAllOptions {
    outputDir: string;
    yes?: boolean;
}

/**
 * Register the rm-all command on the program.
 */
export function registerRmAllCommand(program: Command): Command {
    const rmAllCommand = program
        .command('rm-all')
        .description('Remove all containers created by testcontainers (uses container labels)')
        .argument('[command]', 'Use "help" to show help')
        .option('-o, --output-dir <dir>', 'Output directory to remove', DEFAULT_OUTPUT_DIR)
        .option('-y, --yes', 'Skip confirmation prompt')
        .action(async (command, options: RmAllOptions) => {
            // Handle "npx @mattermost/testcontainers rm-all help"
            if (command === 'help') {
                rmAllCommand.help();
                return;
            }

            await executeRmAllCommand(options);
        });

    return rmAllCommand;
}

/**
 * Execute the rm-all command logic.
 */
async function executeRmAllCommand(options: RmAllOptions): Promise<void> {
    try {
        // Find all containers with testcontainers label
        const containerList = listContainersByLabel('org.testcontainers=true');

        // Get container names and images for display
        const containerDetails: Array<{id: string; name: string; image: string}> = [];
        for (const id of containerList) {
            try {
                const name = getContainerName(id).replace(/^\//, '');
                const image = getContainerImage(id);
                containerDetails.push({id, name, image});
            } catch {
                containerDetails.push({id, name: id, image: 'unknown'});
            }
        }

        // Find networks that will be removed
        const networkIds = listNetworksByLabel('org.testcontainers=true');

        // Check if output directory exists
        const outputDirExists = fs.existsSync(options.outputDir);

        // Check if there's anything to remove
        if (containerDetails.length === 0 && networkIds.length === 0 && !outputDirExists) {
            log('No testcontainers resources found. Nothing to remove.');
            return;
        }

        // Show what will be removed
        log('');
        log('WARNING: This will remove ALL testcontainers resources!');
        log('=========================================================');
        if (containerDetails.length > 0) {
            log(`Containers (${containerDetails.length}):`);
            for (const {name, image, id} of containerDetails) {
                log(`  - ${name}`);
                log(`    Image: ${image}`);
                log(`    ID: ${id}`);
            }
        }
        if (networkIds.length > 0) {
            log('');
            log(`Networks: ${networkIds.length}`);
        }
        if (outputDirExists) {
            log('');
            log(`Output directory: ${options.outputDir}`);
        }
        log('');

        // Ask for confirmation unless --yes is provided
        if (!options.yes) {
            const confirmed = await confirm('Are you sure you want to remove ALL testcontainers resources?');
            if (!confirmed) {
                log('Aborted.');
                return;
            }
        }

        // Stop and remove containers
        if (containerDetails.length > 0) {
            let removedCount = 0;
            for (const {id, name} of containerDetails) {
                try {
                    // Stop if running
                    try {
                        stopContainer(id);
                    } catch {
                        // Already stopped
                    }

                    // Remove
                    removeContainer(id);
                    log(`✓ Removed ${name}`);
                    removedCount++;
                } catch {
                    log(`✗ Failed to remove ${name}`);
                }
            }
            log(`✓ Removed ${removedCount} container(s)`);
        }

        // Remove networks
        if (networkIds.length > 0) {
            let networksRemoved = 0;
            for (const network of networkIds) {
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
        }

        // Remove the output directory
        validateOutputDir(options.outputDir);
        if (outputDirExists) {
            fs.rmSync(options.outputDir, {recursive: true, force: true});
            log(`✓ Removed output directory: ${options.outputDir}`);
        }

        log('✓ All testcontainers resources removed');
    } catch (error) {
        log(`Failed to remove containers: ${error}`);
        process.exit(1);
    }
}
