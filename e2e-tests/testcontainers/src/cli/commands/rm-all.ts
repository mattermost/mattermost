// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as readline from 'readline';

import {Command} from 'commander';

import {DEFAULT_OUTPUT_DIR} from '../../config/config';
import {log} from '../../utils/log';

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
            // Handle "mm-tc rm-all help"
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
        const {execSync} = await import('child_process');

        // Find all containers with testcontainers label
        let containerIds = '';
        try {
            containerIds = execSync('docker ps -aq --filter "label=org.testcontainers=true"', {
                encoding: 'utf-8',
            }).trim();
        } catch {
            // No containers found
        }

        const containerList = containerIds ? containerIds.split('\n').filter(Boolean) : [];

        // Get container names and images for display
        const containerDetails: Array<{id: string; name: string; image: string}> = [];
        for (const id of containerList) {
            try {
                const name = execSync(`docker inspect --format '{{.Name}}' ${id}`, {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                })
                    .trim()
                    .replace(/^\//, '');
                const image = execSync(`docker inspect --format '{{.Config.Image}}' ${id}`, {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                }).trim();
                containerDetails.push({id, name, image});
            } catch {
                containerDetails.push({id, name: id, image: 'unknown'});
            }
        }

        // Find networks that will be removed
        let networkIds: string[] = [];
        try {
            const networks = execSync('docker network ls -q --filter "label=org.testcontainers=true"', {
                encoding: 'utf-8',
            }).trim();
            if (networks) {
                networkIds = networks.split('\n').filter(Boolean);
            }
        } catch {
            // No networks found
        }

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
                        execSync(`docker stop ${id}`, {stdio: ['pipe', 'pipe', 'pipe']});
                    } catch {
                        // Already stopped
                    }

                    // Remove
                    execSync(`docker rm ${id}`, {stdio: ['pipe', 'pipe', 'pipe']});
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
                    execSync(`docker network rm ${network}`, {stdio: ['pipe', 'pipe', 'pipe']});
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
