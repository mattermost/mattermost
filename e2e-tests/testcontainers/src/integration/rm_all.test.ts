// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';
import {spawnSync} from 'child_process';
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
} from './helpers';

const OUTPUT_DIR = path.join(PROJECT_ROOT, '.tc.test-rmall');

describe('rm-all command', {skip: SKIP_DOCKER, timeout: 600_000}, () => {
    let mattermostUrl = '';
    let sessionContainerIds: string[] = [];

    before(() => {
        verifyPrerequisites();
        cleanupOutputDir(OUTPUT_DIR);

        // Start a basic environment so there are containers to remove
        const result = runCli(['start', '--admin', '-o', OUTPUT_DIR]);
        assert.equal(
            result.status,
            0,
            `CLI start failed with exit code ${result.status}.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
        );

        const dockerInfo = readDockerInfo(OUTPUT_DIR);
        const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
        assert.ok(containers?.mattermost?.url, 'Mattermost URL not found in .tc.docker.json');
        mattermostUrl = containers.mattermost.url as string;

        // Record container IDs from this session to verify they're removed
        sessionContainerIds = Object.values(containers)
            .map((c) => c.id as string)
            .filter(Boolean);
    });

    after(() => {
        // Fallback cleanup in case rm-all failed
        cleanupOutputDir(OUTPUT_DIR);
    });

    it('environment starts successfully (precondition)', () => {
        assert.ok(fs.existsSync(path.join(OUTPUT_DIR, '.tc.docker.json')), 'Expected .tc.docker.json to exist');
    });

    it('server API is healthy (precondition)', async () => {
        await assertServerHealthy(mattermostUrl);
    });

    describe('after rm-all --yes', () => {
        let rmAllResult: {status: number | null; stdout: string; stderr: string};

        before(() => {
            rmAllResult = runCli(['rm-all', '-o', OUTPUT_DIR, '--yes'], {timeout: 60_000});
        });

        it('rm-all exits 0', () => {
            assert.equal(rmAllResult.status, 0, `Expected exit code 0, got ${rmAllResult.status}`);
        });

        it('stderr contains "All testcontainers resources removed"', () => {
            assert.ok(
                rmAllResult.stderr.includes('All testcontainers resources removed'),
                `Expected "All testcontainers resources removed" in stderr.\nGot: ${rmAllResult.stderr}`,
            );
        });

        it('session containers are removed', () => {
            assert.ok(sessionContainerIds.length > 0, 'Expected at least one container ID from session');

            for (const id of sessionContainerIds) {
                const result = spawnSync('docker', ['inspect', id], {
                    timeout: 10_000,
                    encoding: 'utf-8',
                });
                // docker inspect returns non-zero if container doesn't exist
                assert.notEqual(result.status, 0, `Expected container ${id} to be removed, but it still exists`);
            }
        });

        it('output directory is deleted', () => {
            assert.ok(!fs.existsSync(OUTPUT_DIR), `Expected output directory ${OUTPUT_DIR} to be deleted`);
        });
    });
});
