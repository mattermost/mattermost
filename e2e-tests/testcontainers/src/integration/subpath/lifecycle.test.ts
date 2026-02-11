// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';
import {describe, it, before, after} from 'node:test';
import assert from 'node:assert/strict';

import {
    PROJECT_ROOT,
    SKIP_DOCKER,
    runCli,
    verifyPrerequisites,
    cleanupOutputDir,
    readDockerInfo,
    httpGet,
    assertServerHealthy,
    assertServerUnreachable,
} from '../helpers';

const OUTPUT_DIR = path.join(PROJECT_ROOT, '.tc.test-subpath');

describe('Subpath lifecycle: start → stop → restart → upgrade → rm', {skip: SKIP_DOCKER, timeout: 900_000}, () => {
    let startStdout = '';
    let startStderr = '';
    let server1Url = '';
    let server2Url = '';

    before(() => {
        verifyPrerequisites();
        cleanupOutputDir(OUTPUT_DIR);

        const result = runCli(['start', '--subpath', '--admin', '-o', OUTPUT_DIR]);
        startStdout = result.stdout;
        startStderr = result.stderr;

        assert.equal(
            result.status,
            0,
            `CLI start failed with exit code ${result.status}.\nstdout: ${startStdout}\nstderr: ${startStderr}`,
        );

        // Extract URLs from .tc.docker.json
        const dockerInfo = readDockerInfo(OUTPUT_DIR);
        const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;

        assert.ok(containers?.nginx?.url, 'Nginx URL not found in .tc.docker.json');

        // Server URLs are constructed from nginx + subpath
        assert.ok(containers?.['mattermost-server1']?.url, 'Server 1 URL not found in .tc.docker.json');
        assert.ok(containers?.['mattermost-server2']?.url, 'Server 2 URL not found in .tc.docker.json');
        server1Url = containers['mattermost-server1'].url as string;
        server2Url = containers['mattermost-server2'].url as string;
    });

    after(() => {
        cleanupOutputDir(OUTPUT_DIR);
    });

    // -------------------------------------------------------------------------
    // Phase: start
    // -------------------------------------------------------------------------

    describe('Phase: start', () => {
        it('start exits 0', () => {
            assert.ok(startStdout.length > 0, 'Expected stdout output');
        });

        it('stdout contains subpath startup message', () => {
            assert.ok(
                startStdout.includes('Starting Mattermost subpath mode') ||
                    startStderr.includes('Starting Mattermost subpath mode'),
                `Expected subpath startup message.\nstdout: ${startStdout}\nstderr: ${startStderr}`,
            );
        });

        it('shows "Environment started successfully"', () => {
            assert.ok(
                startStdout.includes('Environment started successfully'),
                `Expected "Environment started successfully" in stdout.\nGot: ${startStdout}`,
            );
        });

        it('shows Mattermost with nginx/subpaths', () => {
            assert.ok(
                startStdout.includes('(nginx with subpaths)'),
                `Expected "(nginx with subpaths)" in stdout.\nGot: ${startStdout}`,
            );
        });

        it('shows Server 1 URL', () => {
            assert.ok(startStdout.includes('Server 1:'), `Expected "Server 1:" in stdout.\nGot: ${startStdout}`);
        });

        it('shows Server 2 URL', () => {
            assert.ok(startStdout.includes('Server 2:'), `Expected "Server 2:" in stdout.\nGot: ${startStdout}`);
        });

        it('shows PostgreSQL connection', () => {
            assert.match(
                startStdout,
                /PostgreSQL:\s+postgres(ql)?:\/\//,
                'Expected PostgreSQL connection string in stdout',
            );
        });

        it('shows admin user confirmation', () => {
            assert.match(startStdout, /Admin user:\s+sysadmin/, 'Expected admin user confirmation in stdout');
        });

        it('.tc.docker.json has server containers', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, unknown>;
            assert.ok(containers['mattermost-server1'], 'Expected mattermost-server1 container in .tc.docker.json');
            assert.ok(containers['mattermost-server2'], 'Expected mattermost-server2 container in .tc.docker.json');
        });

        it('.tc.docker.json has nginx', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, unknown>;
            assert.ok(containers.nginx, 'Expected nginx container in .tc.docker.json');
        });

        it('.tc.docker.json has dual postgres', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, unknown>;
            assert.ok(containers.postgres, 'Expected postgres container in .tc.docker.json');
            assert.ok(containers.postgres2, 'Expected postgres2 container in .tc.docker.json');
        });

        it('.tc.docker.json has dual inbucket', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, unknown>;
            assert.ok(containers.inbucket, 'Expected inbucket container in .tc.docker.json');
            assert.ok(containers.inbucket2, 'Expected inbucket2 container in .tc.docker.json');
        });

        it('each container has id and image fields', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
            for (const [name, info] of Object.entries(containers)) {
                assert.ok(info.id, `Expected "id" field in container "${name}"`);
                assert.ok(info.image, `Expected "image" field in container "${name}"`);
            }
        });

        it('server 1 API is healthy via subpath', async () => {
            await assertServerHealthy(server1Url);
        });

        it('server 2 API is healthy via subpath', async () => {
            await assertServerHealthy(server2Url);
        });

        it('server 1 homepage is accessible', async () => {
            const response = await httpGet(server1Url);
            assert.equal(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
            assert.ok(
                response.headers['content-type']?.includes('text/html'),
                `Expected text/html content type, got "${response.headers['content-type']}"`,
            );
        });

        it('server 2 homepage is accessible', async () => {
            const response = await httpGet(server2Url);
            assert.equal(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
            assert.ok(
                response.headers['content-type']?.includes('text/html'),
                `Expected text/html content type, got "${response.headers['content-type']}"`,
            );
        });

        it('.tc.server1.config.json exists', () => {
            const configPath = path.join(OUTPUT_DIR, '.tc.server1.config.json');
            assert.ok(fs.existsSync(configPath), `.tc.server1.config.json not found at ${configPath}`);
        });

        it('.tc.server2.config.json exists', () => {
            const configPath = path.join(OUTPUT_DIR, '.tc.server2.config.json');
            assert.ok(fs.existsSync(configPath), `.tc.server2.config.json not found at ${configPath}`);
        });

        it('.env.tc exists', () => {
            const envPath = path.join(OUTPUT_DIR, '.env.tc');
            assert.ok(fs.existsSync(envPath), `.env.tc not found at ${envPath}`);
        });

        it('logs/ has server log files', () => {
            const logsDir = path.join(OUTPUT_DIR, 'logs');
            assert.ok(fs.existsSync(logsDir), `logs/ directory not found at ${logsDir}`);
            const logFiles = fs.readdirSync(logsDir);
            assert.ok(logFiles.length > 0, 'Expected at least one log file in logs/');
            const hasServerLog = logFiles.some((f) => f.includes('mattermost'));
            assert.ok(hasServerLog, `Expected a server log file in logs/. Found: ${logFiles.join(', ')}`);
        });
    });

    // -------------------------------------------------------------------------
    // Phase: stop
    // -------------------------------------------------------------------------

    describe('Phase: stop', () => {
        let stopStderr = '';

        before(() => {
            const result = runCli(['stop', '-o', OUTPUT_DIR], {timeout: 60_000});
            stopStderr = result.stderr;
        });

        it('stderr contains "Stopped"', () => {
            assert.ok(stopStderr.includes('Stopped'), `Expected "Stopped" in stderr.\nGot: ${stopStderr}`);
        });

        it('server 1 API is unreachable', async () => {
            await assertServerUnreachable(server1Url);
        });

        it('server 2 API is unreachable', async () => {
            await assertServerUnreachable(server2Url);
        });

        it('.tc.docker.json still exists', () => {
            const dockerInfoPath = path.join(OUTPUT_DIR, '.tc.docker.json');
            assert.ok(fs.existsSync(dockerInfoPath), '.tc.docker.json should still exist after stop');
        });
    });

    // -------------------------------------------------------------------------
    // Phase: restart
    // -------------------------------------------------------------------------

    describe('Phase: restart', () => {
        let restartStderr = '';

        before(() => {
            const result = runCli(['restart', '-o', OUTPUT_DIR], {timeout: 300_000});
            restartStderr = result.stderr;

            // Re-read docker info — ports may have changed after restart
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
            if (containers?.['mattermost-server1']?.url) {
                server1Url = containers['mattermost-server1'].url as string;
            }
            if (containers?.['mattermost-server2']?.url) {
                server2Url = containers['mattermost-server2'].url as string;
            }
        });

        it('stderr contains "Restart completed"', () => {
            assert.ok(
                restartStderr.includes('Restart completed'),
                `Expected "Restart completed" in stderr.\nGot: ${restartStderr}`,
            );
        });

        it('server 1 API is healthy again', async () => {
            await assertServerHealthy(server1Url);
        });

        it('server 2 API is healthy again', async () => {
            await assertServerHealthy(server2Url);
        });
    });

    // -------------------------------------------------------------------------
    // Phase: upgrade (same tag — fast path)
    // -------------------------------------------------------------------------

    describe('Phase: upgrade (same tag)', () => {
        let upgradeResult: {status: number | null; stdout: string; stderr: string};

        before(() => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
            const image = containers['mattermost-server1']?.image as string;
            const tag = image.split(':').pop() || 'master';

            upgradeResult = runCli(['upgrade', '--tag', tag, '-o', OUTPUT_DIR], {timeout: 120_000});
        });

        it('exits 0 and detects "already running tag"', () => {
            assert.equal(upgradeResult.status, 0, `Expected exit code 0, got ${upgradeResult.status}`);
            assert.ok(
                upgradeResult.stderr.includes('already running tag'),
                `Expected "already running tag" in stderr.\nGot: ${upgradeResult.stderr}`,
            );
        });
    });

    // -------------------------------------------------------------------------
    // Phase: rm
    // -------------------------------------------------------------------------

    describe('Phase: rm', () => {
        let rmStderr = '';

        before(() => {
            const result = runCli(['rm', '-o', OUTPUT_DIR, '--yes'], {timeout: 60_000});
            rmStderr = result.stderr;
        });

        it('stderr contains "Session removed"', () => {
            assert.ok(rmStderr.includes('Session removed'), `Expected "Session removed" in stderr.\nGot: ${rmStderr}`);
        });

        it('output directory is deleted', () => {
            assert.ok(!fs.existsSync(OUTPUT_DIR), `Expected output directory ${OUTPUT_DIR} to be deleted`);
        });
    });
});
