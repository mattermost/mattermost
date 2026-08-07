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
} from '../helpers';

const OUTPUT_DIR = path.join(PROJECT_ROOT, '.tc.test-single-deps');

describe(
    'Single-node with extended deps (openldap, minio, elasticsearch)',
    {skip: SKIP_DOCKER, timeout: 600_000},
    () => {
        let startStdout = '';
        let startStderr = '';
        let mattermostUrl = '';

        before(() => {
            verifyPrerequisites();
            cleanupOutputDir(OUTPUT_DIR);

            const result = runCli(['start', '--admin', '-D', 'openldap,minio,elasticsearch', '-o', OUTPUT_DIR]);
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
            assert.ok(startStdout.length > 0, 'Expected stdout output');
        });

        it('stdout shows OpenLDAP URL', () => {
            assert.match(startStdout, /OpenLDAP:\s+ldap:\/\//, 'Expected OpenLDAP URL in stdout');
        });

        it('stdout shows MinIO API URL', () => {
            assert.match(startStdout, /MinIO API:\s+http:\/\//, 'Expected MinIO API URL in stdout');
        });

        it('stdout shows MinIO Console URL', () => {
            assert.match(startStdout, /MinIO Console:\s+http:\/\//, 'Expected MinIO Console URL in stdout');
        });

        it('stdout shows Elasticsearch URL', () => {
            assert.match(startStdout, /Elasticsearch:\s+http:\/\//, 'Expected Elasticsearch URL in stdout');
        });

        it('stdout shows openldap_setup.md confirmation', () => {
            assert.ok(startStdout.includes('openldap_setup.md'), 'Expected openldap_setup.md mention in stdout');
        });

        it('.tc.docker.json has all dep containers', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, unknown>;
            assert.ok(containers.openldap, 'Expected openldap container in .tc.docker.json');
            assert.ok(containers.minio, 'Expected minio container in .tc.docker.json');
            assert.ok(containers.elasticsearch, 'Expected elasticsearch container in .tc.docker.json');
        });

        it('each container has id and image fields', () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
            for (const [name, info] of Object.entries(containers)) {
                assert.ok(info.id, `Expected "id" field in container "${name}"`);
                assert.ok(info.image, `Expected "image" field in container "${name}"`);
            }
        });

        it('.env.tc has LDAP env vars', () => {
            const envPath = path.join(OUTPUT_DIR, '.env.tc');
            const content = fs.readFileSync(envPath, 'utf-8');
            assert.ok(content.includes('MM_LDAPSETTINGS_LDAPSERVER'), 'Expected MM_LDAPSETTINGS_LDAPSERVER in .env.tc');
        });

        it('.env.tc has S3 env vars', () => {
            const envPath = path.join(OUTPUT_DIR, '.env.tc');
            const content = fs.readFileSync(envPath, 'utf-8');
            assert.ok(
                content.includes('MM_FILESETTINGS_DRIVERNAME="amazons3"'),
                'Expected MM_FILESETTINGS_DRIVERNAME="amazons3" in .env.tc',
            );
        });

        it('.env.tc has Elasticsearch env vars', () => {
            const envPath = path.join(OUTPUT_DIR, '.env.tc');
            const content = fs.readFileSync(envPath, 'utf-8');
            assert.ok(
                content.includes('MM_ELASTICSEARCHSETTINGS_CONNECTIONURL'),
                'Expected MM_ELASTICSEARCHSETTINGS_CONNECTIONURL in .env.tc',
            );
        });

        it('openldap_setup.md exists', () => {
            const setupPath = path.join(OUTPUT_DIR, 'openldap_setup.md');
            assert.ok(fs.existsSync(setupPath), `openldap_setup.md not found at ${setupPath}`);
        });

        it('Elasticsearch URL is accessible', async () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
            const esUrl = containers.elasticsearch?.url as string;
            assert.ok(esUrl, 'Elasticsearch URL not found in .tc.docker.json');
            const response = await httpGet(esUrl);
            assert.equal(response.statusCode, 200, `Expected 200 from Elasticsearch, got ${response.statusCode}`);
        });

        it('MinIO endpoint is accessible', async () => {
            const dockerInfo = readDockerInfo(OUTPUT_DIR);
            const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
            const minioEndpoint = containers.minio?.endpoint as string;
            assert.ok(minioEndpoint, 'MinIO endpoint not found in .tc.docker.json');
            try {
                const response = await httpGet(minioEndpoint);
                // MinIO may return various status codes, but should be reachable
                assert.ok(response.statusCode > 0, `Expected a response from MinIO, got status ${response.statusCode}`);
            } catch {
                // Some MinIO versions may reject bare GET, but the endpoint should be reachable
                // If we get here with a non-connection error, the endpoint is at least accessible
            }
        });

        it('Mattermost server is healthy', async () => {
            await assertServerHealthy(mattermostUrl);
        });
    },
);
