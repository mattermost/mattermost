// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_OUTPUT_DIR } from '../../config/config';
import { log } from '../../utils/log';
/**
 * Register the stop command on the program.
 */
export function registerStopCommand(program) {
    const stopCommand = program
        .command('stop')
        .description('Stop containers from current session')
        .argument('[command]', 'Use "help" to show help')
        .option('-o, --output-dir <dir>', 'Output directory containing .tc.docker.json', DEFAULT_OUTPUT_DIR)
        .action(async (command, options) => {
        // Handle "mm-tc stop help"
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
async function executeStopCommand(options) {
    try {
        const { execSync } = await import('child_process');
        const dockerInfoPath = path.join(options.outputDir, '.tc.docker.json');
        if (!fs.existsSync(dockerInfoPath)) {
            log('No container info found. Nothing to stop.');
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
        // Stop containers
        const stoppedContainers = [];
        for (const [name, info] of containers) {
            try {
                // Check if container exists and is running
                const status = execSync(`docker inspect --format '{{.State.Running}}' ${info.id}`, {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                }).trim();
                if (status === 'true') {
                    execSync(`docker stop ${info.id}`, { stdio: ['pipe', 'pipe', 'pipe'] });
                    stoppedContainers.push(name);
                }
            }
            catch {
                // Container doesn't exist or already stopped
            }
        }
        if (stoppedContainers.length > 0) {
            log(`✓ Stopped ${stoppedContainers.length} container(s): ${stoppedContainers.join(', ')}`);
        }
        else {
            log('No running containers to stop');
        }
    }
    catch (error) {
        log(`Failed to stop containers: ${error}`);
        process.exit(1);
    }
}
