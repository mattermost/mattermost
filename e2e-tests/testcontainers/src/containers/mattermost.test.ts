// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {generateNodeNames, buildMattermostEnv} from './mattermost';

describe('generateNodeNames', () => {
    it('returns ["leader"] for 1 node', () => {
        assert.deepEqual(generateNodeNames(1), ['leader']);
    });

    it('returns leader + follower for 2 nodes', () => {
        assert.deepEqual(generateNodeNames(2), ['leader', 'follower']);
    });

    it('returns leader + follower + follower2 for 3 nodes', () => {
        assert.deepEqual(generateNodeNames(3), ['leader', 'follower', 'follower2']);
    });

    it('handles 5 nodes', () => {
        assert.deepEqual(generateNodeNames(5), ['leader', 'follower', 'follower2', 'follower3', 'follower4']);
    });
});

describe('buildMattermostEnv', () => {
    const baseDeps = {
        postgres: {
            host: 'localhost',
            port: 5432,
            database: 'mattermost_test',
            username: 'mmuser',
            password: 'mmpassword',
            connectionString: 'postgres://mmuser:mmpassword@localhost:5432/mattermost_test',
            image: 'postgres:16',
        },
    };

    it('builds database env vars from postgres deps', () => {
        const env = buildMattermostEnv(baseDeps, {}, {});
        assert.ok(env.MM_CONFIG.includes('mmuser:mmpassword@postgres:5432/mattermost_test'));
        assert.equal(env.MM_SQLSETTINGS_DRIVERNAME, 'postgres');
    });

    it('includes inbucket SMTP settings when inbucket dep is present', () => {
        const deps = {
            ...baseDeps,
            inbucket: {host: 'localhost', smtpPort: 10025, webPort: 10080, pop3Port: 10110, image: 'inbucket:latest'},
        };
        const env = buildMattermostEnv(deps, {}, {});
        assert.equal(env.MM_EMAILSETTINGS_SMTPSERVER, 'inbucket');
        assert.equal(env.MM_EMAILSETTINGS_SMTPPORT, '10025');
    });

    it('includes MM_LICENSE when present in processEnv', () => {
        const env = buildMattermostEnv(baseDeps, {}, {MM_LICENSE: 'my-license'});
        assert.equal(env.MM_LICENSE, 'my-license');
    });

    it('skips MM_LICENSE for team edition', () => {
        const env = buildMattermostEnv(baseDeps, {}, {MM_LICENSE: 'my-license', TC_EDITION: 'team'});
        assert.equal(env.MM_LICENSE, undefined);
    });

    it('skips MM_LICENSE for entry tier', () => {
        const env = buildMattermostEnv(baseDeps, {}, {MM_LICENSE: 'my-license', TC_ENTRY: 'true'});
        assert.equal(env.MM_LICENSE, undefined);
    });

    it('configures cluster settings in HA mode', () => {
        const env = buildMattermostEnv(
            baseDeps,
            {cluster: {enable: true, clusterName: 'test-cluster', nodeName: 'leader', networkAlias: 'leader'}},
            {},
        );
        assert.equal(env.MM_CLUSTERSETTINGS_ENABLE, 'true');
        assert.equal(env.MM_CLUSTERSETTINGS_CLUSTERNAME, 'test-cluster');
    });

    it('applies user overrides', () => {
        const env = buildMattermostEnv(baseDeps, {envOverrides: {CUSTOM_KEY: 'custom_value'}}, {});
        assert.equal(env.CUSTOM_KEY, 'custom_value');
    });

    it('uses custom postgres network alias', () => {
        const deps = {...baseDeps, postgresNetworkAlias: 'pg-custom'};
        const env = buildMattermostEnv(deps, {}, {});
        assert.ok(env.MM_CONFIG.includes('@pg-custom:'));
    });
});
