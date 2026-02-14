// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {describe, it, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveConfig,
    logConfig,
    discoverAndLoadConfig,
    MATTERMOST_EDITION_IMAGES,
    MATTERMOST_RELEASE_IMAGES,
    DEFAULT_SERVER_TAG,
    DEFAULT_IMAGE_MAX_AGE_HOURS,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_ADMIN,
    DEFAULT_CONFIG,
} from './config';

/**
 * All TC_* and MM_* env vars that resolveConfig reads.
 * We save and restore these around each test to avoid pollution.
 */
const ENV_KEYS = [
    'TC_EDITION',
    'TC_SERVER_TAG',
    'TC_IMAGE_MAX_AGE_HOURS',
    'TC_DEPENDENCIES',
    'TC_OUTPUT_DIR',
    'TC_HA',
    'TC_SUBPATH',
    'TC_ENTRY',
    'TC_ADMIN_USERNAME',
    'TC_ADMIN_PASSWORD',
    'TC_SERVER_IMAGE',
    'TC_CONFIG',
    'MM_SERVICEENVIRONMENT',
    'MM_LICENSE',
    'TC_POSTGRES_IMAGE',
    'TC_INBUCKET_IMAGE',
    'TC_OPENLDAP_IMAGE',
    'TC_KEYCLOAK_IMAGE',
    'TC_MINIO_IMAGE',
    'TC_ELASTICSEARCH_IMAGE',
    'TC_OPENSEARCH_IMAGE',
    'TC_REDIS_IMAGE',
    'TC_DEJAVU_IMAGE',
    'TC_PROMETHEUS_IMAGE',
    'TC_GRAFANA_IMAGE',
    'TC_LOKI_IMAGE',
    'TC_PROMTAIL_IMAGE',
    'TC_NGINX_IMAGE',
];

function saveEnv(): Record<string, string | undefined> {
    const saved: Record<string, string | undefined> = {};
    for (const key of ENV_KEYS) {
        saved[key] = process.env[key];
    }
    return saved;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
    for (const key of ENV_KEYS) {
        if (saved[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = saved[key];
        }
    }
}

function clearEnv(): void {
    for (const key of ENV_KEYS) {
        delete process.env[key];
    }
}

// =========================================================================
// resolveConfig — defaults (Usability #1: first-run experience)
// =========================================================================
describe('resolveConfig — defaults (Usability #1)', () => {
    let saved: Record<string, string | undefined>;

    beforeEach(() => {
        saved = saveEnv();
        clearEnv();
    });

    afterEach(() => {
        restoreEnv(saved);
    });

    it('returns enterprise edition by default', () => {
        const config = resolveConfig();
        assert.equal(config.server.edition, 'enterprise');
    });

    it('returns master tag by default', () => {
        const config = resolveConfig();
        assert.equal(config.server.tag, DEFAULT_SERVER_TAG);
        assert.equal(config.server.tag, 'master');
    });

    it('returns postgres and inbucket as default dependencies', () => {
        const config = resolveConfig();
        assert.deepEqual(config.dependencies, ['postgres', 'inbucket']);
    });

    it('builds correct default image from edition and tag', () => {
        const config = resolveConfig();
        assert.equal(config.server.image, `${MATTERMOST_EDITION_IMAGES.enterprise}:master`);
        assert.ok(config.server.image.includes('mattermost-enterprise-edition'));
    });

    it('uses .tc.out as default output directory', () => {
        const config = resolveConfig();
        assert.equal(config.outputDir, DEFAULT_OUTPUT_DIR);
        assert.equal(config.outputDir, '.tc.out');
    });

    it('defaults HA to false', () => {
        const config = resolveConfig();
        assert.equal(config.server.ha, false);
    });

    it('defaults subpath to false', () => {
        const config = resolveConfig();
        assert.equal(config.server.subpath, false);
    });

    it('defaults entry to false', () => {
        const config = resolveConfig();
        assert.equal(config.server.entry, false);
    });

    it('has no admin by default', () => {
        const config = resolveConfig();
        assert.equal(config.admin, undefined);
    });

    it('sets default image max age to 24 hours', () => {
        const config = resolveConfig();
        assert.equal(config.server.imageMaxAgeHours, DEFAULT_IMAGE_MAX_AGE_HOURS);
        assert.equal(config.server.imageMaxAgeHours, 24);
    });
});

// =========================================================================
// resolveConfig — environment variable overrides
// =========================================================================
describe('resolveConfig — env var overrides', () => {
    let saved: Record<string, string | undefined>;

    beforeEach(() => {
        saved = saveEnv();
        clearEnv();
    });

    afterEach(() => {
        restoreEnv(saved);
    });

    it('TC_EDITION overrides edition', () => {
        process.env.TC_EDITION = 'team';
        const config = resolveConfig();
        assert.equal(config.server.edition, 'team');
        assert.ok(config.server.image.includes('mattermost-team-edition'));
    });

    it('TC_EDITION is case-insensitive', () => {
        process.env.TC_EDITION = 'FIPS';
        const config = resolveConfig();
        assert.equal(config.server.edition, 'fips');
    });

    it('TC_SERVER_TAG overrides tag', () => {
        process.env.TC_SERVER_TAG = 'release-11.4';
        const config = resolveConfig();
        assert.equal(config.server.tag, 'release-11.4');
        assert.ok(config.server.image.endsWith(':release-11.4'));
    });

    it('TC_DEPENDENCIES overrides deps with comma-separated values', () => {
        process.env.TC_DEPENDENCIES = 'postgres,inbucket,minio';
        const config = resolveConfig();
        assert.deepEqual(config.dependencies, ['postgres', 'inbucket', 'minio']);
    });

    it('TC_DEPENDENCIES handles spaces around commas', () => {
        process.env.TC_DEPENDENCIES = 'postgres , inbucket , openldap';
        const config = resolveConfig();
        assert.deepEqual(config.dependencies, ['postgres', 'inbucket', 'openldap']);
    });

    it('TC_HA=true enables HA mode', () => {
        process.env.TC_HA = 'true';
        const config = resolveConfig();
        assert.equal(config.server.ha, true);
    });

    it('TC_HA=false disables HA mode', () => {
        process.env.TC_HA = 'false';
        const config = resolveConfig();
        assert.equal(config.server.ha, false);
    });

    it('TC_SUBPATH=true enables subpath mode', () => {
        process.env.TC_SUBPATH = 'true';
        const config = resolveConfig();
        assert.equal(config.server.subpath, true);
    });

    it('TC_ENTRY=true enables entry tier', () => {
        process.env.TC_ENTRY = 'true';
        const config = resolveConfig();
        assert.equal(config.server.entry, true);
    });

    it('TC_ADMIN_USERNAME creates admin config', () => {
        process.env.TC_ADMIN_USERNAME = 'myadmin';
        const config = resolveConfig();
        assert.ok(config.admin);
        assert.equal(config.admin.username, 'myadmin');
        assert.equal(config.admin.email, 'myadmin@sample.mattermost.com');
        assert.equal(config.admin.password, DEFAULT_ADMIN.password);
    });

    it('TC_ADMIN_PASSWORD overrides admin password', () => {
        process.env.TC_ADMIN_USERNAME = 'myadmin';
        process.env.TC_ADMIN_PASSWORD = 'Secret123!';
        const config = resolveConfig();
        assert.ok(config.admin);
        assert.equal(config.admin.password, 'Secret123!');
    });

    it('TC_SERVER_IMAGE overrides full image (highest priority)', () => {
        process.env.TC_SERVER_IMAGE = 'custom-registry/custom-image:v1.0';
        const config = resolveConfig();
        assert.equal(config.server.image, 'custom-registry/custom-image:v1.0');
    });

    it('TC_SERVER_IMAGE overrides even when edition and tag are also set', () => {
        process.env.TC_EDITION = 'team';
        process.env.TC_SERVER_TAG = 'release-11.0';
        process.env.TC_SERVER_IMAGE = 'my-image:latest';
        const config = resolveConfig();
        assert.equal(config.server.image, 'my-image:latest');
        // Edition and tag still reflect env values
        assert.equal(config.server.edition, 'team');
        assert.equal(config.server.tag, 'release-11.0');
    });

    it('MM_SERVICEENVIRONMENT overrides service environment', () => {
        process.env.MM_SERVICEENVIRONMENT = 'production';
        const config = resolveConfig();
        assert.equal(config.server.serviceEnvironment, 'production');
    });

    it('TC_OUTPUT_DIR overrides output directory', () => {
        process.env.TC_OUTPUT_DIR = 'custom-output';
        const config = resolveConfig();
        assert.equal(config.outputDir, 'custom-output');
    });

    it('TC_POSTGRES_IMAGE overrides postgres image', () => {
        process.env.TC_POSTGRES_IMAGE = 'postgres:16';
        const config = resolveConfig();
        assert.equal(config.images.postgres, 'postgres:16');
    });
});

// =========================================================================
// resolveConfig — config file merging
// =========================================================================
describe('resolveConfig — config file merging', () => {
    let saved: Record<string, string | undefined>;

    beforeEach(() => {
        saved = saveEnv();
        clearEnv();
    });

    afterEach(() => {
        restoreEnv(saved);
    });

    it('user config merges with defaults', () => {
        const config = resolveConfig({
            server: {edition: 'fips', tag: 'release-11.4'},
            dependencies: ['postgres', 'inbucket', 'minio'],
        });
        assert.equal(config.server.edition, 'fips');
        assert.equal(config.server.tag, 'release-11.4');
        assert.deepEqual(config.dependencies, ['postgres', 'inbucket', 'minio']);
        // Image is rebuilt from edition+tag
        assert.equal(config.server.image, `${MATTERMOST_RELEASE_IMAGES.fips}:release-11.4`);
    });

    it('env vars override config file values', () => {
        process.env.TC_EDITION = 'team';
        const config = resolveConfig({
            server: {edition: 'enterprise'},
        });
        // Env var wins over config file
        assert.equal(config.server.edition, 'team');
    });

    it('config file admin is applied', () => {
        const config = resolveConfig({
            admin: {username: 'admin-from-config'},
        });
        assert.ok(config.admin);
        assert.equal(config.admin.username, 'admin-from-config');
        assert.equal(config.admin.email, 'admin-from-config@sample.mattermost.com');
    });

    it('config file images are merged with defaults', () => {
        const config = resolveConfig({
            images: {postgres: 'postgres:16'},
        });
        assert.equal(config.images.postgres, 'postgres:16');
        // Other images retain defaults
        assert.equal(config.images.inbucket, DEFAULT_CONFIG.images.inbucket);
    });

    it('config file output dir is applied', () => {
        const config = resolveConfig({
            outputDir: 'my-output',
        });
        assert.equal(config.outputDir, 'my-output');
    });
});

// =========================================================================
// logConfig — output format (Usability #8 partial)
// =========================================================================
describe('logConfig', () => {
    let saved: Record<string, string | undefined>;

    beforeEach(() => {
        saved = saveEnv();
        clearEnv();
    });

    afterEach(() => {
        restoreEnv(saved);
    });

    it('outputs expected header and server info', () => {
        const lines: string[] = [];
        const logger = (msg: string) => lines.push(msg);
        const config = resolveConfig();
        logConfig(logger, config);

        assert.ok(lines.some((l) => l.includes('Testcontainers Configuration:')));
        assert.ok(lines.some((l) => l.includes('Server:')));
        assert.ok(lines.some((l) => l.includes('enterprise')));
        assert.ok(lines.some((l) => l.includes('master')));
    });

    it('shows enabled dependencies', () => {
        const lines: string[] = [];
        const logger = (msg: string) => lines.push(msg);
        const config = resolveConfig();
        logConfig(logger, config);

        assert.ok(lines.some((l) => l.includes('postgres') && l.includes('inbucket')));
    });

    it('shows HA mode when enabled', () => {
        const lines: string[] = [];
        const logger = (msg: string) => lines.push(msg);
        process.env.TC_HA = 'true';
        const config = resolveConfig();
        logConfig(logger, config);

        assert.ok(lines.some((l) => /HA mode.*enabled/i.test(l)));
    });

    it('shows subpath mode when enabled', () => {
        const lines: string[] = [];
        const logger = (msg: string) => lines.push(msg);
        process.env.TC_SUBPATH = 'true';
        const config = resolveConfig();
        logConfig(logger, config);

        assert.ok(lines.some((l) => /Subpath mode.*enabled/i.test(l)));
    });

    it('shows admin user when configured', () => {
        const lines: string[] = [];
        const logger = (msg: string) => lines.push(msg);
        process.env.TC_ADMIN_USERNAME = 'testadmin';
        const config = resolveConfig();
        logConfig(logger, config);

        assert.ok(lines.some((l) => l.includes('testadmin')));
    });

    it('shows image max age', () => {
        const lines: string[] = [];
        const logger = (msg: string) => lines.push(msg);
        const config = resolveConfig();
        logConfig(logger, config);

        assert.ok(lines.some((l) => l.includes('24') && l.includes('hours')));
    });
});

// =========================================================================
// discoverAndLoadConfig — config auto-discovery (Usability #9)
// =========================================================================
describe('discoverAndLoadConfig — auto-discovery (Usability #9)', () => {
    let saved: Record<string, string | undefined>;
    let tmpDir: string;

    beforeEach(() => {
        saved = saveEnv();
        clearEnv();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-test-'));
    });

    afterEach(() => {
        restoreEnv(saved);
        fs.rmSync(tmpDir, {recursive: true, force: true});
    });

    it('returns defaults when no config file exists', async () => {
        const config = await discoverAndLoadConfig({searchDir: tmpDir});
        assert.equal(config.server.edition, 'enterprise');
        assert.equal(config.server.tag, 'master');
        assert.deepEqual(config.dependencies, ['postgres', 'inbucket']);
    });

    it('loads .jsonc config file when discovered', async () => {
        const configPath = path.join(tmpDir, 'mattermost-testcontainers.config.jsonc');
        fs.writeFileSync(
            configPath,
            JSON.stringify({
                server: {edition: 'fips', tag: 'release-11.0'},
                dependencies: ['postgres', 'inbucket', 'openldap'],
            }),
        );
        const config = await discoverAndLoadConfig({searchDir: tmpDir});
        assert.equal(config.server.edition, 'fips');
        assert.equal(config.server.tag, 'release-11.0');
        assert.deepEqual(config.dependencies, ['postgres', 'inbucket', 'openldap']);
    });

    it('loads explicit configFile path', async () => {
        const configPath = path.join(tmpDir, 'custom.jsonc');
        fs.writeFileSync(
            configPath,
            JSON.stringify({
                server: {tag: 'release-10.0'},
            }),
        );
        const config = await discoverAndLoadConfig({configFile: configPath});
        assert.equal(config.server.tag, 'release-10.0');
    });

    it('throws when explicit configFile does not exist', async () => {
        await assert.rejects(
            () => discoverAndLoadConfig({configFile: path.join(tmpDir, 'nonexistent.jsonc')}),
            /Config file not found/,
        );
    });

    it('loads config via TC_CONFIG env var', async () => {
        const configPath = path.join(tmpDir, 'env-config.jsonc');
        fs.writeFileSync(
            configPath,
            JSON.stringify({
                server: {tag: 'from-env'},
            }),
        );
        process.env.TC_CONFIG = configPath;
        const config = await discoverAndLoadConfig();
        assert.equal(config.server.tag, 'from-env');
    });
});

// =========================================================================
// package.json structure (Usability #10: npx experience)
// =========================================================================
describe('package.json structure (Usability #10)', () => {
    let pkg: Record<string, unknown>;

    beforeEach(() => {
        const pkgPath = path.resolve(__dirname, '../../package.json');
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    });

    it('has a bin entry for testcontainers', () => {
        const bin = pkg.bin as Record<string, string>;
        assert.ok(bin['testcontainers'], 'Missing bin entry for testcontainers');
        assert.ok(
            bin['testcontainers'].endsWith('cli.js'),
            `bin entry should point to cli.js, got: ${bin['testcontainers']}`,
        );
    });

    it('has exports for "." entry point', () => {
        const exports = pkg.exports as Record<string, Record<string, string>>;
        assert.ok(exports['.'], 'Missing exports "." entry');
        assert.ok(exports['.'].import || exports['.'].require, 'Exports "." must have import or require');
    });

    it('has main and types fields', () => {
        assert.ok(pkg.main, 'Missing main field');
        assert.ok(pkg.types, 'Missing types field');
    });
});
