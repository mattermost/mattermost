// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { DEFAULT_OUTPUT_DIR } from '../../config/config';
import { log } from '../../utils/log';
/**
 * Prompt user for confirmation.
 */
async function confirm(message) {
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
export function registerRmCommand(program) {
    const rmCommand = program
        .command('rm')
        .description('Stop and remove containers from current session')
        .argument('[command]', 'Use "help" to show help')
        .option('-o, --output-dir <dir>', 'Output directory containing .tc.docker.json', DEFAULT_OUTPUT_DIR)
        .option('-y, --yes', 'Skip confirmation prompt')
        .action(async (command, options) => {
        // Handle "mm-tc rm help"
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
async function executeRmCommand(options) {
    try {
        const { execSync } = await import('child_process');
        const dockerInfoPath = path.join(options.outputDir, '.tc.docker.json');
        if (!fs.existsSync(dockerInfoPath)) {
            log('No container info found. Nothing to remove.');
            return;
        }
        const dockerInfoRaw = fs.readFileSync(dockerInfoPath, 'utf-8');
        const dockerInfo = JSON.parse(dockerInfoRaw);
        // Get all containers from docker info
        const containers = Object.entries(dockerInfo.containers).filter((entry) => entry[1] !== undefined);
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
        const removedContainers = [];
        for (const [name, info] of containers) {
            try {
                // Check if container exists
                execSync(`docker inspect ${info.id}`, {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
                // Stop container if running
                try {
                    execSync(`docker stop ${info.id}`, { stdio: ['pipe', 'pipe', 'pipe'] });
                }
                catch {
                    // Container might already be stopped
                }
                // Remove container
                execSync(`docker rm ${info.id}`, { stdio: ['pipe', 'pipe', 'pipe'] });
                removedContainers.push(name);
            }
            catch {
                // Container doesn't exist or already removed
            }
        }
        if (removedContainers.length > 0) {
            log(`✓ Removed ${removedContainers.length} container(s): ${removedContainers.join(', ')}`);
        }
        // Find and remove testcontainers networks
        let networksRemoved = 0;
        try {
            const networks = execSync('docker network ls -q --filter "label=org.testcontainers=true"', {
                encoding: 'utf-8',
            }).trim();
            if (networks) {
                for (const network of networks.split('\n').filter(Boolean)) {
                    try {
                        execSync(`docker network rm ${network}`, { stdio: ['pipe', 'pipe', 'pipe'] });
                        networksRemoved++;
                    }
                    catch {
                        // Network might be in use
                    }
                }
            }
        }
        catch {
            // No networks found
        }
        if (networksRemoved > 0) {
            log(`✓ Removed ${networksRemoved} network(s)`);
        }
        // Remove the output directory
        if (fs.existsSync(options.outputDir)) {
            fs.rmSync(options.outputDir, { recursive: true, force: true });
            log(`✓ Removed output directory: ${options.outputDir}`);
        }
        log('✓ Session removed');
    }
    catch (error) {
        log(`Failed to remove containers: ${error}`);
        process.exit(1);
    }
}
