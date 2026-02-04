// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_OUTPUT_DIR } from '../../config/config';
import { log } from '../../utils/log';
import { waitForContainer, getServerVersion, getServerConfig, saveConfigDiff } from '../container-utils';
/**
 * Register the restart command on the program.
 */
export function registerRestartCommand(program) {
    program
        .command('restart')
        .description('Restart all containers from current session')
        .option('-o, --output-dir <dir>', 'Output directory containing .tc.docker.json', DEFAULT_OUTPUT_DIR)
        .action(async (options) => {
        await executeRestartCommand(options);
    });
}
/**
 * Execute the restart command logic.
 */
async function executeRestartCommand(options) {
    try {
        const { execSync } = await import('child_process');
        const outputDir = options.outputDir;
        const dockerInfoPath = path.join(outputDir, '.tc.docker.json');
        if (!fs.existsSync(dockerInfoPath)) {
            log('No container info found. Nothing to restart.');
            return;
        }
        const dockerInfoRaw = fs.readFileSync(dockerInfoPath, 'utf-8');
        const dockerInfo = JSON.parse(dockerInfoRaw);
        // Get all container keys
        const allContainerKeys = Object.keys(dockerInfo.containers);
        if (allContainerKeys.length === 0) {
            log('No containers found. Nothing to restart.');
            return;
        }
        // Separate into dependencies and mattermost containers
        const mmContainerKeys = allContainerKeys.filter((key) => key === 'mattermost' || key.startsWith('mattermost-'));
        const depContainerKeys = allContainerKeys.filter((key) => key !== 'mattermost' && !key.startsWith('mattermost-'));
        log(`Containers to restart: ${allContainerKeys.join(', ')}`);
        let hasErrors = false;
        // Get config from mattermost containers before restart (if running)
        const configsBefore = new Map();
        for (const containerKey of mmContainerKeys) {
            const containerInfo = dockerInfo.containers[containerKey];
            if (!containerInfo)
                continue;
            try {
                const isRunning = execSync(`docker inspect --format '{{.State.Running}}' ${containerInfo.id}`, {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                }).trim() === 'true';
                if (isRunning) {
                    log(`Getting config from ${containerKey}...`);
                    const configBefore = getServerConfig(execSync, containerInfo.id);
                    configsBefore.set(containerKey, configBefore);
                }
                else {
                    configsBefore.set(containerKey, null);
                }
            }
            catch {
                configsBefore.set(containerKey, null);
            }
        }
        // Step 1: Stop mattermost containers first (so they disconnect cleanly from dependencies)
        for (const containerKey of mmContainerKeys) {
            const containerInfo = dockerInfo.containers[containerKey];
            if (!containerInfo)
                continue;
            try {
                const isRunning = execSync(`docker inspect --format '{{.State.Running}}' ${containerInfo.id}`, {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                }).trim() === 'true';
                if (isRunning) {
                    log(`Stopping ${containerKey}...`);
                    execSync(`docker stop ${containerInfo.id}`, { stdio: ['pipe', 'pipe', 'pipe'] });
                    log(`✓ ${containerKey} stopped`);
                }
            }
            catch {
                // Container might not exist
            }
        }
        // Step 2: Restart dependency containers and verify they're running
        if (depContainerKeys.length > 0) {
            log('Restarting dependencies...');
            for (const containerKey of depContainerKeys) {
                const containerInfo = dockerInfo.containers[containerKey];
                if (!containerInfo)
                    continue;
                try {
                    execSync(`docker inspect ${containerInfo.id}`, {
                        encoding: 'utf-8',
                        stdio: ['pipe', 'pipe', 'pipe'],
                    });
                }
                catch {
                    log(`✗ ${containerKey} container not found`);
                    hasErrors = true;
                    continue;
                }
                const isRunning = execSync(`docker inspect --format '{{.State.Running}}' ${containerInfo.id}`, {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                }).trim() === 'true';
                if (isRunning) {
                    log(`Restarting ${containerKey}...`);
                    try {
                        execSync(`docker restart ${containerInfo.id}`, { stdio: ['pipe', 'pipe', 'pipe'] });
                    }
                    catch (error) {
                        log(`✗ ${containerKey} failed to restart: ${error}`);
                        hasErrors = true;
                        continue;
                    }
                }
                else {
                    log(`Starting ${containerKey}...`);
                    try {
                        execSync(`docker start ${containerInfo.id}`, { stdio: ['pipe', 'pipe', 'pipe'] });
                    }
                    catch (error) {
                        log(`✗ ${containerKey} failed to start: ${error}`);
                        hasErrors = true;
                        continue;
                    }
                }
                // Verify container is running
                const nowRunning = execSync(`docker inspect --format '{{.State.Running}}' ${containerInfo.id}`, {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                }).trim() === 'true';
                if (nowRunning) {
                    log(`✓ ${containerKey} running`);
                }
                else {
                    log(`✗ ${containerKey} not running`);
                    hasErrors = true;
                }
            }
            // Wait for postgres to be healthy and ready for connections
            // Uses exponential backoff: 1s, 2s, 4s, 8s (4 degrees), repeated 3 times
            const postgresInfo = dockerInfo.containers.postgres;
            if (postgresInfo?.id) {
                log('Waiting for postgres to be ready...');
                const startTime = Date.now();
                let postgresReady = false;
                const maxRetries = 3;
                const backoffDelays = [1000, 2000, 4000, 8000]; // 4 degrees of exponential backoff
                const pgUser = postgresInfo.username || 'mmuser';
                const pgDatabase = postgresInfo.database || 'mattermost_test';
                for (let retry = 0; retry < maxRetries && !postgresReady; retry++) {
                    for (const delay of backoffDelays) {
                        try {
                            // Run a simple SQL query to verify postgres is ready
                            // Use PGPASSWORD env var and disable password prompt with -w
                            execSync(`docker exec -e PGPASSWORD=mostest ${postgresInfo.id} psql -U ${pgUser} -d ${pgDatabase} -w -c "SELECT 1"`, {
                                stdio: ['pipe', 'pipe', 'pipe'],
                                timeout: 5000,
                            });
                            postgresReady = true;
                            break;
                        }
                        catch {
                            // Not ready yet, wait with exponential backoff
                            await new Promise((resolve) => setTimeout(resolve, delay));
                        }
                    }
                }
                const waitTime = ((Date.now() - startTime) / 1000).toFixed(1);
                if (postgresReady) {
                    log(`✓ postgres ready (${waitTime}s)`);
                }
                else {
                    log(`⚠ postgres may not be fully ready (timeout after ${waitTime}s)`);
                }
            }
            // Final verification: ensure all dependencies are running before starting mattermost
            log('Verifying all dependencies are running...');
            let allDepsRunning = true;
            for (const containerKey of depContainerKeys) {
                const containerInfo = dockerInfo.containers[containerKey];
                if (!containerInfo)
                    continue;
                try {
                    const isRunning = execSync(`docker inspect --format '{{.State.Running}}' ${containerInfo.id}`, {
                        encoding: 'utf-8',
                        stdio: ['pipe', 'pipe', 'pipe'],
                    }).trim() === 'true';
                    if (!isRunning) {
                        log(`✗ ${containerKey} is not running`);
                        allDepsRunning = false;
                    }
                }
                catch {
                    log(`✗ ${containerKey} check failed`);
                    allDepsRunning = false;
                }
            }
            if (allDepsRunning) {
                log('✓ All dependencies running');
            }
            else {
                log('⚠ Some dependencies are not running. Mattermost may fail to start.');
                hasErrors = true;
            }
        }
        // Step 3: Restart mattermost containers (use docker restart to preserve ports)
        const restartedContainers = [];
        for (const containerKey of mmContainerKeys) {
            const containerInfo = dockerInfo.containers[containerKey];
            if (!containerInfo)
                continue;
            try {
                execSync(`docker inspect ${containerInfo.id}`, {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
            }
            catch {
                log(`✗ ${containerKey} container not found`);
                hasErrors = true;
                continue;
            }
            log(`Starting ${containerKey}...`);
            try {
                // Use docker start since container was stopped earlier
                // docker restart on stopped container just starts it
                execSync(`docker start ${containerInfo.id}`, { stdio: ['pipe', 'pipe', 'pipe'] });
                // Get actual port after start to verify it matches expected
                let actualPort = containerInfo.port;
                try {
                    const portOutput = execSync(`docker port ${containerInfo.id} 8065`, {
                        encoding: 'utf-8',
                        stdio: ['pipe', 'pipe', 'pipe'],
                    }).trim();
                    const portMatch = portOutput.match(/:(\d+)$/m);
                    if (portMatch) {
                        actualPort = parseInt(portMatch[1], 10);
                    }
                }
                catch {
                    // Port check failed, use original
                }
                // Update info with actual port
                const actualUrl = `http://localhost:${actualPort}`;
                const updatedInfo = { ...containerInfo, port: actualPort, url: actualUrl };
                restartedContainers.push({ key: containerKey, info: updatedInfo, containerId: containerInfo.id });
                if (actualPort !== containerInfo.port) {
                    log(`✓ ${containerKey} started (port changed: ${containerInfo.port} → ${actualPort})`);
                }
                else {
                    log(`✓ ${containerKey} started (port ${actualPort})`);
                }
            }
            catch (error) {
                log(`✗ ${containerKey} failed to start: ${error}`);
                hasErrors = true;
            }
        }
        if (restartedContainers.length === 0 && depContainerKeys.length === 0) {
            log('No containers were restarted');
            return;
        }
        // Wait for all mattermost containers to be ready
        let newVersion = 'unknown';
        for (const { key, info, containerId } of restartedContainers) {
            const url = info.url;
            log(`Waiting for ${key} to be ready...`);
            const isReady = await waitForContainer(url, 120000); // 2 minutes for restart
            if (isReady) {
                const version = await getServerVersion(url);
                if (newVersion === 'unknown' && version !== 'unknown') {
                    newVersion = version;
                }
                log(`✓ ${key} ready at ${url} (v${version})`);
                // Get config after restart and save diff
                const configBefore = configsBefore.get(key) ?? null;
                const configAfter = getServerConfig(execSync, containerId);
                saveConfigDiff(outputDir, 'restart', configBefore, configAfter);
            }
            else {
                log(`⚠ ${key} may not be fully ready (timeout after 120s)`);
            }
        }
        // Update docker info file if ports changed
        let portsChanged = false;
        for (const { key, info } of restartedContainers) {
            const originalInfo = dockerInfo.containers[key];
            if (originalInfo && info.port !== originalInfo.port) {
                dockerInfo.containers[key] = {
                    ...originalInfo,
                    port: info.port,
                    url: info.url,
                };
                portsChanged = true;
            }
        }
        if (portsChanged) {
            fs.writeFileSync(dockerInfoPath, JSON.stringify(dockerInfo, null, 2) + '\n');
            log('Docker info updated with new ports');
        }
        log(`✓ Restart completed${newVersion !== 'unknown' ? `: v${newVersion}` : ''}`);
        // Print connection info for all services (use updated info from restartedContainers)
        log('');
        log('Connection Information:');
        log('=======================');
        // Get mattermost URL from restarted containers (has updated port)
        const mmInfo = restartedContainers.find((c) => c.key === 'mattermost');
        if (mmInfo) {
            log(`Mattermost:      ${mmInfo.info.url}`);
        }
        const c = dockerInfo.containers;
        if (c.postgres?.connectionString) {
            log(`PostgreSQL:      ${c.postgres.connectionString}`);
        }
        if (c.inbucket?.host && c.inbucket?.webPort) {
            log(`Inbucket:        http://${c.inbucket.host}:${c.inbucket.webPort}`);
        }
        if (c.openldap?.host && c.openldap?.port) {
            log(`OpenLDAP:        ldap://${c.openldap.host}:${c.openldap.port}`);
        }
        if (c.minio?.endpoint) {
            log(`MinIO:           ${c.minio.endpoint}`);
        }
        if (c.elasticsearch?.url) {
            log(`Elasticsearch:   ${c.elasticsearch.url}`);
        }
        if (c.opensearch?.url) {
            log(`OpenSearch:      ${c.opensearch.url}`);
        }
        if (c.keycloak?.adminUrl) {
            log(`Keycloak:        ${c.keycloak.adminUrl}`);
        }
        if (c.redis?.url) {
            log(`Redis:           ${c.redis.url}`);
        }
        if (hasErrors) {
            log('');
            log('Note: Some containers failed to restart. Check the errors above.');
        }
    }
    catch (error) {
        log(`Restart failed: ${error}`);
        process.exit(1);
    }
}
