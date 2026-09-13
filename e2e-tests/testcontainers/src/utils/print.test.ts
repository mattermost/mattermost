// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import type {DependencyConnectionInfo} from '@/config/types';

import {printConnectionInfo} from './print';

function makePostgres(): DependencyConnectionInfo['postgres'] {
    return {
        host: 'localhost',
        port: 5432,
        database: 'mattermost_test',
        username: 'mmuser',
        password: 'mostest',
        connectionString: 'postgres://mmuser:mostest@localhost:5432/mattermost_test',
        image: 'postgres:14',
    };
}

// =========================================================================
// printConnectionInfo — output readability (Usability #8)
// =========================================================================
describe('printConnectionInfo — output readability (Usability #8)', () => {
    it('shows header line', () => {
        const lines: string[] = [];
        const info: DependencyConnectionInfo = {postgres: makePostgres()};
        printConnectionInfo(info, (msg) => lines.push(msg));

        assert.ok(lines.some((l) => l.includes('Test Environment Connection Info:')));
    });

    it('shows separator line', () => {
        const lines: string[] = [];
        const info: DependencyConnectionInfo = {postgres: makePostgres()};
        printConnectionInfo(info, (msg) => lines.push(msg));

        assert.ok(lines.some((l) => l.includes('===')));
    });

    it('always shows PostgreSQL connection string', () => {
        const lines: string[] = [];
        const info: DependencyConnectionInfo = {postgres: makePostgres()};
        printConnectionInfo(info, (msg) => lines.push(msg));

        assert.ok(lines.some((l) => l.includes('PostgreSQL') && l.includes('postgres://')));
    });

    it('shows Mattermost URL when present', () => {
        const lines: string[] = [];
        const info: DependencyConnectionInfo = {
            postgres: makePostgres(),
            mattermost: {
                host: 'localhost',
                port: 8065,
                url: 'http://localhost:8065',
                internalUrl: 'http://mattermost:8065',
                image: 'mattermost/mattermost-enterprise-edition:master',
            },
        };
        printConnectionInfo(info, (msg) => lines.push(msg));

        assert.ok(lines.some((l) => l.includes('Mattermost') && l.includes('http://localhost:8065')));
    });

    it('omits services not in connection info', () => {
        const lines: string[] = [];
        const info: DependencyConnectionInfo = {postgres: makePostgres()};
        printConnectionInfo(info, (msg) => lines.push(msg));

        const joined = lines.join('\n');
        assert.ok(!joined.includes('undefined'), 'Output should not contain "undefined"');
        assert.ok(!joined.includes('null'), 'Output should not contain "null"');
        assert.ok(!joined.includes('Mattermost'), 'Mattermost should not appear when not set');
        assert.ok(!joined.includes('Inbucket'), 'Inbucket should not appear when not set');
        assert.ok(!joined.includes('OpenLDAP'), 'OpenLDAP should not appear when not set');
        assert.ok(!joined.includes('MinIO'), 'MinIO should not appear when not set');
        assert.ok(!joined.includes('Redis'), 'Redis should not appear when not set');
    });

    it('shows all enabled optional services', () => {
        const lines: string[] = [];
        const info: DependencyConnectionInfo = {
            postgres: makePostgres(),
            inbucket: {host: 'localhost', smtpPort: 10025, webPort: 9001, pop3Port: 10110, image: 'inbucket:stable'},
            minio: {
                host: 'localhost',
                port: 9000,
                consolePort: 9002,
                accessKey: 'minioaccesskey',
                secretKey: 'miniosecretkey',
                endpoint: 'http://localhost:9000',
                consoleUrl: 'http://localhost:9002',
                image: 'minio/minio:latest',
            },
            elasticsearch: {
                host: 'localhost',
                port: 9200,
                url: 'http://localhost:9200',
                image: 'elasticsearch:8.9.0',
            },
            redis: {
                host: 'localhost',
                port: 6379,
                url: 'redis://localhost:6379',
                image: 'redis:7.4.0',
            },
        };
        printConnectionInfo(info, (msg) => lines.push(msg));

        const joined = lines.join('\n');
        assert.ok(joined.includes('PostgreSQL'), 'Should show PostgreSQL');
        assert.ok(joined.includes('Inbucket'), 'Should show Inbucket');
        assert.ok(joined.includes('MinIO'), 'Should show MinIO');
        assert.ok(joined.includes('Elasticsearch'), 'Should show Elasticsearch');
        assert.ok(joined.includes('Redis'), 'Should show Redis');
    });

    it('shows observability services when enabled', () => {
        const lines: string[] = [];
        const info: DependencyConnectionInfo = {
            postgres: makePostgres(),
            prometheus: {host: 'localhost', port: 9090, url: 'http://localhost:9090', image: 'prom/prometheus:v2.46.0'},
            grafana: {host: 'localhost', port: 3000, url: 'http://localhost:3000', image: 'grafana/grafana:10.4.2'},
            loki: {host: 'localhost', port: 3100, url: 'http://localhost:3100', image: 'grafana/loki:3.0.0'},
            promtail: {host: 'localhost', port: 9080, url: 'http://localhost:9080', image: 'grafana/promtail:3.0.0'},
        };
        printConnectionInfo(info, (msg) => lines.push(msg));

        const joined = lines.join('\n');
        assert.ok(joined.includes('Prometheus'), 'Should show Prometheus');
        assert.ok(joined.includes('Grafana'), 'Should show Grafana');
        assert.ok(joined.includes('Loki'), 'Should show Loki');
        assert.ok(joined.includes('Promtail'), 'Should show Promtail');
    });
});
