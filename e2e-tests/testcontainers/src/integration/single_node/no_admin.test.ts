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
    assertServerHealthy,
} from '../helpers';

const OUTPUT_DIR = path.join(PROJECT_ROOT, '.tc.test-single-noadmin');

describe('Single-node without admin', {skip: SKIP_DOCKER, timeout: 600_000}, () => {
    let startStdout = '';
    let startStderr = '';
    let mattermostUrl = '';

    before(() => {
        verifyPrerequisites();
        cleanupOutputDir(OUTPUT_DIR);

        // Start without --admin
        const result = runCli(['start', '-o', OUTPUT_DIR]);
        startStdout = result.stdout;
        startStderr = result.stderr;

        assert.equal(
            result.status,
            0,
            `CLI start failed with exit code ${result.status}.\nstdout: ${startStdout}\nstderr: ${startStderr}`,
        );

        const dockerInfo = readDockerInfo(OUTPUT_DIR);
        const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
        assert.ok(containers?.mattermost?.url, 'Mattermost URL not found in .tc.docker.json');
        mattermostUrl = containers.mattermost.url as string;
    });

    after(() => {
        cleanupOutputDir(OUTPUT_DIR);
    });

    it('start exits 0', () => {
        // Already asserted in before(), but included for explicit test count
        assert.ok(startStdout.length > 0, 'Expected stdout output');
    });

    it('shows "Environment started successfully"', () => {
        assert.ok(
            startStdout.includes('Environment started successfully'),
            `Expected "Environment started successfully" in stdout.\nGot: ${startStdout}`,
        );
    });

    it('does NOT contain "Admin user:"', () => {
        assert.ok(
            !startStdout.includes('Admin user:'),
            `Expected no "Admin user:" in stdout when --admin is not used.\nGot: ${startStdout}`,
        );
    });

    it('server API is healthy', async () => {
        await assertServerHealthy(mattermostUrl);
    });

    it('.tc.docker.json has mattermost and postgres', () => {
        const dockerInfo = readDockerInfo(OUTPUT_DIR);
        const containers = dockerInfo.containers as Record<string, unknown>;
        assert.ok(containers.mattermost, 'Expected mattermost container in .tc.docker.json');
        assert.ok(containers.postgres, 'Expected postgres container in .tc.docker.json');
    });

    it('.env.tc exists', () => {
        const envPath = path.join(OUTPUT_DIR, '.env.tc');
        assert.ok(fs.existsSync(envPath), `.env.tc not found at ${envPath}`);
    });
});
