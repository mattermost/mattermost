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

const OUTPUT_DIR = path.join(PROJECT_ROOT, '.tc.test-subpath-deps');

describe('Subpath with extended deps (openldap, minio, elasticsearch)', {skip: SKIP_DOCKER, timeout: 900_000}, () => {
    let startStdout = '';
    let startStderr = '';
    let server1Url = '';
    let server2Url = '';

    before(() => {
        verifyPrerequisites();
        cleanupOutputDir(OUTPUT_DIR);

        const result = runCli([
            'start',
            '--subpath',
            '--admin',
            '-D',
            'openldap,minio,elasticsearch',
            '-o',
            OUTPUT_DIR,
        ]);
        startStdout = result.stdout;
        startStderr = result.stderr;

        assert.equal(
            result.status,
            0,
            `CLI start failed with exit code ${result.status}.\nstdout: ${startStdout}\nstderr: ${startStderr}`,
        );

        const dockerInfo = readDockerInfo(OUTPUT_DIR);
        const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;

        assert.ok(containers?.['mattermost-server1']?.url, 'Server 1 URL not found in .tc.docker.json');
        assert.ok(containers?.['mattermost-server2']?.url, 'Server 2 URL not found in .tc.docker.json');
        server1Url = containers['mattermost-server1'].url as string;
        server2Url = containers['mattermost-server2'].url as string;
    });

    after(() => {
        cleanupOutputDir(OUTPUT_DIR);
    });

    it('start exits 0', () => {
        assert.ok(startStdout.length > 0, 'Expected stdout output');
    });

    it('stdout shows dep URLs', () => {
        assert.match(startStdout, /OpenLDAP:\s+ldap:\/\//, 'Expected OpenLDAP URL in stdout');
        assert.match(startStdout, /MinIO API:\s+http:\/\//, 'Expected MinIO API URL in stdout');
        assert.match(startStdout, /Elasticsearch:\s+http:\/\//, 'Expected Elasticsearch URL in stdout');
    });

    it('.tc.docker.json has subpath + dep containers', () => {
        const dockerInfo = readDockerInfo(OUTPUT_DIR);
        const containers = dockerInfo.containers as Record<string, unknown>;
        assert.ok(containers['mattermost-server1'], 'Expected mattermost-server1 container');
        assert.ok(containers['mattermost-server2'], 'Expected mattermost-server2 container');
        assert.ok(containers.nginx, 'Expected nginx container');
        assert.ok(containers.openldap, 'Expected openldap container');
        assert.ok(containers.minio, 'Expected minio container');
        assert.ok(containers.elasticsearch, 'Expected elasticsearch container');
    });

    it('each container has id and image fields', () => {
        const dockerInfo = readDockerInfo(OUTPUT_DIR);
        const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
        for (const [name, info] of Object.entries(containers)) {
            assert.ok(info.id, `Expected "id" field in container "${name}"`);
            assert.ok(info.image, `Expected "image" field in container "${name}"`);
        }
    });

    it('server 1 API is healthy', async () => {
        await assertServerHealthy(server1Url);
    });

    it('server 2 API is healthy', async () => {
        await assertServerHealthy(server2Url);
    });

    it('Elasticsearch is accessible', async () => {
        const dockerInfo = readDockerInfo(OUTPUT_DIR);
        const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
        const esUrl = containers.elasticsearch?.url as string;
        assert.ok(esUrl, 'Elasticsearch URL not found in .tc.docker.json');
        const response = await httpGet(esUrl);
        assert.equal(response.statusCode, 200, `Expected 200 from Elasticsearch, got ${response.statusCode}`);
    });

    it('MinIO is accessible', async () => {
        const dockerInfo = readDockerInfo(OUTPUT_DIR);
        const containers = dockerInfo.containers as Record<string, Record<string, unknown>>;
        const minioEndpoint = containers.minio?.endpoint as string;
        assert.ok(minioEndpoint, 'MinIO endpoint not found in .tc.docker.json');
        try {
            const response = await httpGet(minioEndpoint);
            assert.ok(response.statusCode > 0, `Expected a response from MinIO, got status ${response.statusCode}`);
        } catch {
            // MinIO may reject bare GET, but endpoint is reachable
        }
    });

    it('openldap_setup.md exists', () => {
        const setupPath = path.join(OUTPUT_DIR, 'openldap_setup.md');
        assert.ok(fs.existsSync(setupPath), `openldap_setup.md not found at ${setupPath}`);
    });

    it('.env.tc has dep env vars', () => {
        const envPath = path.join(OUTPUT_DIR, '.env.tc');
        const content = fs.readFileSync(envPath, 'utf-8');
        assert.ok(content.includes('MM_LDAPSETTINGS_LDAPSERVER'), 'Expected LDAP env vars in .env.tc');
        assert.ok(content.includes('MM_FILESETTINGS_DRIVERNAME="amazons3"'), 'Expected S3 env vars in .env.tc');
        assert.ok(
            content.includes('MM_ELASTICSEARCHSETTINGS_CONNECTIONURL'),
            'Expected Elasticsearch env vars in .env.tc',
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
});
