// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {
    MATTERMOST_RELEASE_IMAGES,
    DEFAULT_ADMIN,
    DEFAULT_CONFIG,
    type ResolvedTestcontainersConfig,
} from '@/config/config';

import {validateOutputDir, applyCliOverrides, buildServerEnv} from './utils';

function makeBaseConfig(overrides?: Partial<ResolvedTestcontainersConfig>): ResolvedTestcontainersConfig {
    return {
        ...DEFAULT_CONFIG,
        server: {...DEFAULT_CONFIG.server},
        images: {...DEFAULT_CONFIG.images},
        ...overrides,
    };
}

describe('validateOutputDir', () => {
    it('accepts a relative path within cwd', () => {
        assert.doesNotThrow(() => validateOutputDir('.tc.out'));
    });

    it('accepts a nested relative path', () => {
        assert.doesNotThrow(() => validateOutputDir('output/test'));
    });

    it('rejects a path that escapes cwd with ../', () => {
        assert.throws(() => validateOutputDir('../escape'), /Unsafe output directory/);
    });

    it('rejects an absolute path outside cwd', () => {
        assert.throws(() => validateOutputDir('/tmp/outside'), /Unsafe output directory/);
    });

    it('rejects cwd itself', () => {
        assert.throws(() => validateOutputDir('.'), /Output directory cannot be the current working directory/);
    });
});

// =========================================================================
// applyCliOverrides
// =========================================================================
describe('applyCliOverrides', () => {
    it('normalizes edition to lowercase', () => {
        const config = makeBaseConfig();
        const result = applyCliOverrides(config, {edition: 'FIPS'});
        assert.equal(result.server.edition, 'fips');
    });

    it('applies tag override', () => {
        const config = makeBaseConfig();
        const result = applyCliOverrides(config, {tag: 'release-11.4'});
        assert.equal(result.server.tag, 'release-11.4');
    });

    it('adds deps to existing without duplicates', () => {
        const config = makeBaseConfig();
        // Default deps are ['postgres', 'inbucket']
        const result = applyCliOverrides(config, {deps: 'inbucket,minio,openldap'});
        assert.deepEqual(result.dependencies, ['postgres', 'inbucket', 'minio', 'openldap']);
    });

    it('--ha sets ha to true', () => {
        const config = makeBaseConfig();
        const result = applyCliOverrides(config, {ha: true});
        assert.equal(result.server.ha, true);
    });

    it('--subpath sets subpath to true', () => {
        const config = makeBaseConfig();
        const result = applyCliOverrides(config, {subpath: true});
        assert.equal(result.server.subpath, true);
    });

    it('--entry sets entry to true', () => {
        const config = makeBaseConfig();
        const result = applyCliOverrides(config, {entry: true});
        assert.equal(result.server.entry, true);
    });

    it('--admin creates admin config with default username', () => {
        const config = makeBaseConfig();
        const result = applyCliOverrides(config, {admin: true});
        assert.ok(result.admin);
        assert.equal(result.admin.username, DEFAULT_ADMIN.username);
        assert.equal(result.admin.password, DEFAULT_ADMIN.password);
        assert.equal(result.admin.email, `${DEFAULT_ADMIN.username}@sample.mattermost.com`);
    });

    it('--admin with string creates admin config with custom username', () => {
        const config = makeBaseConfig();
        const result = applyCliOverrides(config, {admin: 'myadmin', adminPassword: 'MyPass1!'});
        assert.ok(result.admin);
        assert.equal(result.admin.username, 'myadmin');
        assert.equal(result.admin.password, 'MyPass1!');
        assert.equal(result.admin.email, 'myadmin@sample.mattermost.com');
    });

    it('rebuilds server image from edition+tag after override', () => {
        const config = makeBaseConfig();
        const result = applyCliOverrides(config, {edition: 'team', tag: 'release-11.0'});
        assert.equal(result.server.image, `${MATTERMOST_RELEASE_IMAGES.team}:release-11.0`);
    });

    it('does not mutate the original config', () => {
        const config = makeBaseConfig();
        const originalEdition = config.server.edition;
        applyCliOverrides(config, {edition: 'team'});
        assert.equal(config.server.edition, originalEdition);
    });

    it('applies service environment override', () => {
        const config = makeBaseConfig();
        const result = applyCliOverrides(config, {serviceEnv: 'production'});
        assert.equal(result.server.serviceEnvironment, 'production');
    });

    it('applies output directory override', () => {
        const config = makeBaseConfig();
        const result = applyCliOverrides(config, {outputDir: 'my-output'});
        assert.equal(result.outputDir, 'my-output');
    });
});

// =========================================================================
// buildServerEnv
// =========================================================================
describe('buildServerEnv', () => {
    it('returns default "test" service env for container mode', () => {
        const config = makeBaseConfig();
        const env = buildServerEnv(config, {});
        assert.equal(env.MM_SERVICEENVIRONMENT, 'test');
    });

    it('returns "dev" for deps-only mode', () => {
        const config = makeBaseConfig();
        const env = buildServerEnv(config, {depsOnly: true});
        assert.equal(env.MM_SERVICEENVIRONMENT, 'dev');
    });

    it('CLI -E overrides config file env', () => {
        const config = makeBaseConfig();
        config.server.env = {MY_KEY: 'from-config', OVERRIDE_ME: 'old'};
        const env = buildServerEnv(config, {env: ['OVERRIDE_ME=new', 'EXTRA=extra']});
        assert.equal(env.MY_KEY, 'from-config');
        assert.equal(env.OVERRIDE_ME, 'new');
        assert.equal(env.EXTRA, 'extra');
    });

    it('rejects invalid KEY=value format', () => {
        const config = makeBaseConfig();
        assert.throws(
            () => buildServerEnv(config, {env: ['INVALID_NO_EQUALS']}),
            /Invalid environment variable format/,
        );
    });

    it('handles KEY=value where value contains equals signs', () => {
        const config = makeBaseConfig();
        const env = buildServerEnv(config, {env: ['MY_KEY=val=ue=with=equals']});
        assert.equal(env.MY_KEY, 'val=ue=with=equals');
    });

    it('config file serviceEnvironment is applied when no CLI override', () => {
        const config = makeBaseConfig();
        config.server.serviceEnvironment = 'production';
        const env = buildServerEnv(config, {});
        assert.equal(env.MM_SERVICEENVIRONMENT, 'production');
    });

    it('CLI serviceEnv overrides config file serviceEnvironment', () => {
        const config = makeBaseConfig();
        config.server.serviceEnvironment = 'production';
        const env = buildServerEnv(config, {serviceEnv: 'dev'});
        assert.equal(env.MM_SERVICEENVIRONMENT, 'dev');
    });

    it('loads env file and merges values', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-envfile-'));
        const envFilePath = path.join(tmpDir, '.env');
        fs.writeFileSync(envFilePath, 'FROM_FILE=hello\nANOTHER=world\n');

        try {
            const config = makeBaseConfig();
            const env = buildServerEnv(config, {envFile: envFilePath});
            assert.equal(env.FROM_FILE, 'hello');
            assert.equal(env.ANOTHER, 'world');
        } finally {
            fs.rmSync(tmpDir, {recursive: true, force: true});
        }
    });

    it('throws when env file does not exist', () => {
        const config = makeBaseConfig();
        assert.throws(() => buildServerEnv(config, {envFile: '/nonexistent/.env'}), /Env file not found/);
    });
});
