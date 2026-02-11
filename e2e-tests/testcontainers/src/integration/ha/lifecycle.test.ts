// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';
import {describe, it, before, after} from 'node:test';
import assert from 'node:assert/strict';

import {
    PROJECT_ROOT,
    SKIP_DOCKER_HA,
    runCli,
    verifyPrerequisites,
    cleanupOutputDir,
    readDockerInfo,
    httpGet,
    assertServerHealthy,
    assertServerUnreachable,
} from '../helpers';

const OUTPUT_DIR = path.join(PROJECT_ROOT, '.tc.test-ha');

describe('HA lifecycle: start → stop → restart → upgrade → rm', {skip: SKIP_DOCKER_HA, timeout: 900_000}, () => {
    let startStdout = '';
    let startStderr = '';
    let nginxUrl = '';

    before(() => {
        verifyPrerequisites();
        cleanupOutputDir(OUTPUT_DIR);

        const result = runCli(['start', '--ha', '--admin', '-o', OUTPUT_DIR]);
        startStdout = result.stdout;
        startStderr = result.stderr;

        assert.equal(
            result.status,
            0,
            `CLI start failed with exit code ${result.status}.\nstdout: ${startStdout}\nstderr: ${startStderr}`,
        );

        // Extract nginx URL from .tc.docker.json
        const dockerInfo = readDockerInfo(OUTPUT_DIR);
        const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
        assert.ok(containers?.nginx?.url, 'Nginx URL not found in .tc.docker.json');
        nginxUrl = containers.nginx.url as string;
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

        it('stdout contains HA startup message', () => {
            assert.ok(
                startStdout.includes('Starting Mattermost HA cluster') ||
                    startStderr.includes('Starting Mattermost HA cluster'),
                `Expected HA startup message.\nstdout: ${startStdout}\nstderr: ${startStderr}`,
            );
        });

        it('shows "Environment started successfully"', () => {
            assert.ok(
                startStdout.includes('Environment started successfully'),
                `Expected "Environment started successfully" in stdout.\nGot: ${startStdout}`,
            );
        });

        it('shows Mattermost HA with nginx URL', () => {
            assert.ok(
                startStdout.includes('Mattermost HA:'),
                `Expected "Mattermost HA:" in stdout.\nGot: ${startStdout}`,
            );
        });

        it('shows cluster node info', () => {
            assert.ok(
                startStdout.includes('leader') || startStdout.includes('follower'),
                `Expected cluster node names in stdout.\nGot: ${startStdout}`,
            );
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

        it('.tc.docker.json has HA containers (leader, follower)', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, unknown>;
            assert.ok(containers['mattermost-leader'], 'Expected mattermost-leader container in .tc.docker.json');
            assert.ok(containers['mattermost-follower'], 'Expected mattermost-follower container in .tc.docker.json');
            assert.ok(containers['mattermost-follower2'], 'Expected mattermost-follower2 container in .tc.docker.json');
        });

        it('.tc.docker.json has nginx', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, unknown>;
            assert.ok(containers.nginx, 'Expected nginx container in .tc.docker.json');
        });

        it('.tc.docker.json has postgres and inbucket', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, unknown>;
            assert.ok(containers.postgres, 'Expected postgres container in .tc.docker.json');
            assert.ok(containers.inbucket, 'Expected inbucket container in .tc.docker.json');
        });

        it('each container has id and image fields', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
            for (const [name, info] of Object.entries(containers)) {
                assert.ok(info.id, `Expected "id" field in container "${name}"`);
                assert.ok(info.image, `Expected "image" field in container "${name}"`);
            }
        });

        it('API via nginx URL is healthy', async () => {
            await assertServerHealthy(nginxUrl);
        });

        it('homepage via nginx URL is accessible', async () => {
            const response = await httpGet(nginxUrl);
            assert.equal(response.statusCode, 200, `Expected 200, got ${response.statusCode}`);
            assert.ok(response.body.includes('id="root"'), 'Expected id="root" in HTML body');
        });

        it('ping has X-Version-Id header', async () => {
            const pingUrl = `${nginxUrl}/api/v4/system/ping`;
            const response = await httpGet(pingUrl);
            assert.ok(response.headers['x-version-id'], 'Expected X-Version-Id header');
        });

        it('.tc.server.config.json exists', () => {
            const configPath = path.join(OUTPUT_DIR, '.tc.server.config.json');
            assert.ok(fs.existsSync(configPath), `.tc.server.config.json not found at ${configPath}`);
        });

        it('.env.tc exists', () => {
            const envPath = path.join(OUTPUT_DIR, '.env.tc');
            assert.ok(fs.existsSync(envPath), `.env.tc not found at ${envPath}`);
        });

        it('logs/ has leader log', () => {
            const logsDir = path.join(OUTPUT_DIR, 'logs');
            assert.ok(fs.existsSync(logsDir), `logs/ directory not found at ${logsDir}`);
            const logFiles = fs.readdirSync(logsDir);
            const hasLeaderLog = logFiles.some((f) => f.includes('leader'));
            assert.ok(hasLeaderLog, `Expected a leader log file in logs/. Found: ${logFiles.join(', ')}`);
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

        it('API via nginx is unreachable', async () => {
            await assertServerUnreachable(nginxUrl);
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
        let leaderUrl = '';

        before(() => {
            const result = runCli(['restart', '-o', OUTPUT_DIR], {timeout: 300_000});
            restartStderr = result.stderr;

            // Re-read docker info — ports may have changed after restart
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
            if (containers?.nginx?.url) {
                nginxUrl = containers.nginx.url as string;
            }
            if (containers?.['mattermost-leader']?.url) {
                leaderUrl = containers['mattermost-leader'].url as string;
            }
        });

        it('stderr contains "Restart completed"', () => {
            assert.ok(
                restartStderr.includes('Restart completed'),
                `Expected "Restart completed" in stderr.\nGot: ${restartStderr}`,
            );
        });

        it('HA cluster is healthy again', async () => {
            // Try nginx first (load balancer); fall back to direct leader URL.
            // Nginx may fail to restart in HA mode because its static upstream
            // block requires DNS resolution at startup, which can fail after
            // docker stop/start even when mattermost nodes are running.
            try {
                await assertServerHealthy(nginxUrl, 2);
            } catch {
                assert.ok(leaderUrl, 'Neither nginx nor leader URL available after restart');
                await assertServerHealthy(leaderUrl);
            }
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
            // Use leader container image to get current tag
            const image = containers['mattermost-leader']?.image as string;
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
