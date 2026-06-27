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

const OUTPUT_DIR = path.join(PROJECT_ROOT, '.tc.test-single');

describe('Single-node lifecycle: start → stop → restart → upgrade → rm', {skip: SKIP_DOCKER, timeout: 600_000}, () => {
    let startStdout = '';
    let startStderr = '';
    let mattermostUrl = '';

    before(() => {
        verifyPrerequisites();

        // Clean up any leftover output directory from a prior aborted run
        cleanupOutputDir(OUTPUT_DIR);

        // Start environment: single-node with admin
        const result = runCli(['start', '--admin', '-o', OUTPUT_DIR]);
        startStdout = result.stdout;
        startStderr = result.stderr;

        assert.equal(
            result.status,
            0,
            `CLI start failed with exit code ${result.status}.\nstdout: ${startStdout}\nstderr: ${startStderr}`,
        );

        // Parse .tc.docker.json to extract Mattermost URL
        const dockerInfo = readDockerInfo(OUTPUT_DIR);
        const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
        assert.ok(containers?.mattermost?.url, 'Mattermost URL not found in .tc.docker.json');
        mattermostUrl = containers.mattermost.url as string;
    });

    after(() => {
        cleanupOutputDir(OUTPUT_DIR);
    });

    // -------------------------------------------------------------------------
    // Phase: start
    // -------------------------------------------------------------------------

    describe('Phase: start', () => {
        it('shows "Environment started successfully"', () => {
            assert.ok(
                startStdout.includes('Environment started successfully'),
                `Expected "Environment started successfully" in stdout.\nGot: ${startStdout}`,
            );
        });

        it('shows "Connection Information:" header with separator', () => {
            assert.ok(
                startStdout.includes('Connection Information:'),
                `Expected "Connection Information:" in stdout.\nGot: ${startStdout}`,
            );
            assert.ok(
                startStdout.includes('======================='),
                `Expected "=======================" separator in stdout.\nGot: ${startStdout}`,
            );
        });

        it('shows Mattermost URL', () => {
            assert.match(startStdout, /Mattermost:\s+http:\/\/localhost:\d+/, 'Expected Mattermost URL in stdout');
        });

        it('shows PostgreSQL connection string', () => {
            assert.match(
                startStdout,
                /PostgreSQL:\s+postgres(ql)?:\/\//,
                'Expected PostgreSQL connection string in stdout',
            );
        });

        it('shows Inbucket URL', () => {
            assert.match(startStdout, /Inbucket:\s+http:\/\//, 'Expected Inbucket URL in stdout');
        });

        it('shows admin user confirmation', () => {
            assert.match(startStdout, /Admin user:\s+sysadmin/, 'Expected admin user confirmation in stdout');
        });

        it('shows output file confirmations', () => {
            assert.ok(startStdout.includes('.env.tc'), 'Expected .env.tc mention in stdout');
            assert.ok(
                startStdout.includes('.tc.docker.json') || startStdout.includes('Docker container info'),
                'Expected .tc.docker.json or Docker container info mention in stdout',
            );
            assert.ok(
                startStdout.includes('Server configuration') || startStdout.includes('.tc.server.config.json'),
                'Expected server configuration mention in stdout',
            );
        });

        it('contains [tc] operational messages in stderr', () => {
            assert.ok(startStderr.includes('[tc]'), 'Expected [tc] log messages in stderr');
        });

        it('/api/v4/system/ping returns 200 OK', async () => {
            const response = await assertServerHealthy(mattermostUrl);
            assert.equal(response.statusCode, 200);
        });

        it('ping response has X-Version-Id header', async () => {
            const pingUrl = `${mattermostUrl}/api/v4/system/ping`;
            const response = await httpGet(pingUrl);
            assert.ok(response.headers['x-version-id'], 'Expected X-Version-Id header in ping response');
        });

        it('GET / returns 200 with HTML', async () => {
            const response = await httpGet(mattermostUrl);
            assert.equal(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
            assert.ok(
                response.headers['content-type']?.includes('text/html'),
                `Expected text/html content type, got "${response.headers['content-type']}"`,
            );
        });

        it('HTML contains id="root"', async () => {
            const response = await httpGet(mattermostUrl);
            assert.ok(response.body.includes('id="root"'), 'Expected id="root" in HTML body (React SPA mount point)');
        });

        it('.tc.docker.json has startedAt and containers with mattermost and postgres', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            assert.ok(dockerInfo.startedAt, 'Expected startedAt in .tc.docker.json');
            assert.ok(dockerInfo.containers, 'Expected containers in .tc.docker.json');
            const containers = dockerInfo.containers as Record<string, unknown>;
            assert.ok(containers.mattermost, 'Expected mattermost container in .tc.docker.json');
            assert.ok(containers.postgres, 'Expected postgres container in .tc.docker.json');
        });

        it('each container has id and image fields', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
            for (const [name, info] of Object.entries(containers)) {
                assert.ok(info.id, `Expected "id" field in container "${name}"`);
                assert.ok(info.image, `Expected "image" field in container "${name}"`);
            }
        });

        it('.env.tc has MM_SQLSETTINGS_DATASOURCE', () => {
            const envPath = path.join(OUTPUT_DIR, '.env.tc');
            assert.ok(fs.existsSync(envPath), `.env.tc not found at ${envPath}`);
            const content = fs.readFileSync(envPath, 'utf-8');
            assert.ok(
                content.includes('export MM_SQLSETTINGS_DATASOURCE='),
                'Expected MM_SQLSETTINGS_DATASOURCE in .env.tc',
            );
        });

        it('logs/ has mattermost log', () => {
            const logsDir = path.join(OUTPUT_DIR, 'logs');
            assert.ok(fs.existsSync(logsDir), `logs/ directory not found at ${logsDir}`);
            const logFiles = fs.readdirSync(logsDir);
            assert.ok(logFiles.length > 0, 'Expected at least one log file in logs/');
            const hasMattermostLog = logFiles.some((f) => f.includes('mattermost'));
            assert.ok(hasMattermostLog, `Expected a mattermost log file in logs/. Found: ${logFiles.join(', ')}`);
        });

        it('.tc.server.config.json has ServiceSettings', () => {
            const configPath = path.join(OUTPUT_DIR, '.tc.server.config.json');
            assert.ok(fs.existsSync(configPath), `.tc.server.config.json not found at ${configPath}`);
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            assert.ok(config.ServiceSettings, 'Expected ServiceSettings in server config');
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

        it('stderr contains "Stopped" and container names', () => {
            assert.ok(stopStderr.includes('Stopped'), `Expected "Stopped" in stderr.\nGot: ${stopStderr}`);
        });

        it('server API is unreachable', async () => {
            await assertServerUnreachable(mattermostUrl);
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
            if (containers?.mattermost?.url) {
                mattermostUrl = containers.mattermost.url as string;
            }
        });

        it('stderr contains "Restart completed"', () => {
            assert.ok(
                restartStderr.includes('Restart completed'),
                `Expected "Restart completed" in stderr.\nGot: ${restartStderr}`,
            );
        });

        it('server API is healthy again', async () => {
            await assertServerHealthy(mattermostUrl);
        });
    });

    // -------------------------------------------------------------------------
    // Phase: upgrade (same tag — fast path)
    // -------------------------------------------------------------------------

    describe('Phase: upgrade (same tag)', () => {
        let upgradeResult: {status: number | null; stdout: string; stderr: string};

        before(() => {
            // Read current tag from docker info
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
            const image = containers.mattermost?.image as string;
            const tag = image.split(':').pop() || 'master';

            upgradeResult = runCli(['upgrade', '--tag', tag, '-o', OUTPUT_DIR], {timeout: 120_000});
        });

        it('exits 0', () => {
            assert.equal(upgradeResult.status, 0, `Expected exit code 0, got ${upgradeResult.status}`);
        });

        it('stderr contains "already running tag"', () => {
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
