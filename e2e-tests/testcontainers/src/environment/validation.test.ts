// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, it, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';

import type {ResolvedTestcontainersConfig} from '@/config/config';

import {validateDependencies} from './validation';

function makeConfig(overrides: Partial<ResolvedTestcontainersConfig['server']> = {}): ResolvedTestcontainersConfig {
    return {
        dependencies: ['postgres', 'inbucket'],
        outputDir: '.tc.out',
        server: {
            edition: 'enterprise',
            tag: 'master',
            image: 'mattermost/mattermost-enterprise-edition:master',
            ha: false,
            subpath: false,
            entry: false,
            ...overrides,
        },
        images: {},
    } as ResolvedTestcontainersConfig;
}

describe('validateDependencies', () => {
    let savedLicense: string | undefined;

    beforeEach(() => {
        savedLicense = process.env.MM_LICENSE;
        process.env.MM_LICENSE = 'test-license';
    });

    afterEach(() => {
        if (savedLicense === undefined) {
            delete process.env.MM_LICENSE;
        } else {
            process.env.MM_LICENSE = savedLicense;
        }
    });

    it('accepts valid dependency combinations', () => {
        assert.doesNotThrow(() => {
            validateDependencies(['postgres', 'inbucket', 'openldap', 'minio'], makeConfig());
        });
    });

    it('rejects elasticsearch + opensearch together', () => {
        assert.throws(
            () => validateDependencies(['postgres', 'inbucket', 'elasticsearch', 'opensearch'], makeConfig()),
            /Cannot enable both elasticsearch and opensearch/,
        );
    });

    it('rejects dejavu without search engine', () => {
        assert.throws(
            () => validateDependencies(['postgres', 'inbucket', 'dejavu'], makeConfig()),
            /Cannot enable dejavu without a search engine/,
        );
    });

    it('accepts dejavu with elasticsearch', () => {
        assert.doesNotThrow(() => {
            validateDependencies(['postgres', 'inbucket', 'elasticsearch', 'dejavu'], makeConfig());
        });
    });

    it('rejects loki without promtail', () => {
        assert.throws(
            () => validateDependencies(['postgres', 'inbucket', 'loki'], makeConfig()),
            /Cannot enable loki without promtail/,
        );
    });

    it('rejects promtail without loki', () => {
        assert.throws(
            () => validateDependencies(['postgres', 'inbucket', 'promtail'], makeConfig()),
            /Cannot enable promtail without loki/,
        );
    });

    it('accepts loki + promtail together', () => {
        assert.doesNotThrow(() => {
            validateDependencies(['postgres', 'inbucket', 'loki', 'promtail'], makeConfig());
        });
    });

    it('rejects grafana without data source', () => {
        assert.throws(
            () => validateDependencies(['postgres', 'inbucket', 'grafana'], makeConfig()),
            /Cannot enable grafana without a data source/,
        );
    });

    it('accepts grafana with prometheus', () => {
        assert.doesNotThrow(() => {
            validateDependencies(['postgres', 'inbucket', 'prometheus', 'grafana'], makeConfig());
        });
    });

    it('rejects redis without license', () => {
        delete process.env.MM_LICENSE;
        assert.throws(
            () => validateDependencies(['postgres', 'inbucket', 'redis'], makeConfig()),
            /Cannot enable redis without MM_LICENSE/,
        );
    });

    it('rejects redis with team edition', () => {
        assert.throws(
            () => validateDependencies(['postgres', 'inbucket', 'redis'], makeConfig({edition: 'team'})),
            /Cannot enable redis without MM_LICENSE/,
        );
    });

    it('rejects HA without license', () => {
        delete process.env.MM_LICENSE;
        assert.throws(
            () => validateDependencies(['postgres', 'inbucket'], makeConfig({ha: true})),
            /Cannot enable HA mode without MM_LICENSE/,
        );
    });

    it('rejects HA with team edition', () => {
        assert.throws(
            () => validateDependencies(['postgres', 'inbucket'], makeConfig({ha: true, edition: 'team'})),
            /Cannot enable HA mode without MM_LICENSE/,
        );
    });

    it('rejects entry tier with team edition', () => {
        assert.throws(
            () => validateDependencies(['postgres', 'inbucket'], makeConfig({entry: true, edition: 'team'})),
            /Cannot use --entry.*with team edition/,
        );
    });
});

// =========================================================================
// Usability #2–#7: Error messages contain helpful guidance
// =========================================================================
describe('validateDependencies — error messages are descriptive', () => {
    let savedLicense: string | undefined;

    beforeEach(() => {
        savedLicense = process.env.MM_LICENSE;
        process.env.MM_LICENSE = 'test-license';
    });

    afterEach(() => {
        if (savedLicense === undefined) {
            delete process.env.MM_LICENSE;
        } else {
            process.env.MM_LICENSE = savedLicense;
        }
    });

    it('elasticsearch+opensearch error mentions "one search engine" (Usability #3)', () => {
        try {
            validateDependencies(['postgres', 'elasticsearch', 'opensearch'], makeConfig());
            assert.fail('Expected an error');
        } catch (err: unknown) {
            const msg = (err as Error).message;
            assert.ok(msg.includes('one search engine'), `Error should mention "one search engine", got: ${msg}`);
        }
    });

    it('dejavu error mentions "elasticsearch or opensearch" (Usability #4)', () => {
        try {
            validateDependencies(['postgres', 'dejavu'], makeConfig());
            assert.fail('Expected an error');
        } catch (err: unknown) {
            const msg = (err as Error).message;
            assert.ok(
                msg.includes('elasticsearch') && msg.includes('opensearch'),
                `Error should tell user to enable elasticsearch or opensearch, got: ${msg}`,
            );
        }
    });

    it('loki-without-promtail error mentions "loki,promtail" (Usability #5)', () => {
        try {
            validateDependencies(['postgres', 'loki'], makeConfig());
            assert.fail('Expected an error');
        } catch (err: unknown) {
            const msg = (err as Error).message;
            assert.ok(
                msg.includes('loki') && msg.includes('promtail'),
                `Error should mention both loki and promtail, got: ${msg}`,
            );
        }
    });

    it('promtail-without-loki error mentions "Loki" (Usability #5)', () => {
        try {
            validateDependencies(['postgres', 'promtail'], makeConfig());
            assert.fail('Expected an error');
        } catch (err: unknown) {
            const msg = (err as Error).message;
            assert.ok(/[Ll]oki/.test(msg), `Error should mention Loki, got: ${msg}`);
        }
    });

    it('grafana error mentions "prometheus and/or loki" (Usability #6)', () => {
        try {
            validateDependencies(['postgres', 'grafana'], makeConfig());
            assert.fail('Expected an error');
        } catch (err: unknown) {
            const msg = (err as Error).message;
            assert.ok(msg.includes('prometheus'), `Error should mention prometheus, got: ${msg}`);
            assert.ok(msg.includes('loki'), `Error should mention loki, got: ${msg}`);
        }
    });

    it('redis error mentions "MM_LICENSE" (Usability #7)', () => {
        delete process.env.MM_LICENSE;
        try {
            validateDependencies(['postgres', 'redis'], makeConfig());
            assert.fail('Expected an error');
        } catch (err: unknown) {
            const msg = (err as Error).message;
            assert.ok(msg.includes('MM_LICENSE'), `Error should mention MM_LICENSE, got: ${msg}`);
        }
    });

    it('HA error mentions "MM_LICENSE" and "team edition" (Usability #2)', () => {
        delete process.env.MM_LICENSE;
        try {
            validateDependencies(['postgres'], makeConfig({ha: true}));
            assert.fail('Expected an error');
        } catch (err: unknown) {
            const msg = (err as Error).message;
            assert.ok(msg.includes('MM_LICENSE'), `Error should mention MM_LICENSE, got: ${msg}`);
            assert.ok(msg.includes('team edition'), `Error should mention team edition, got: ${msg}`);
        }
    });

    it('entry+team error mentions "enterprise and fips" editions', () => {
        try {
            validateDependencies(['postgres'], makeConfig({entry: true, edition: 'team'}));
            assert.fail('Expected an error');
        } catch (err: unknown) {
            const msg = (err as Error).message;
            assert.ok(msg.includes('enterprise'), `Error should mention enterprise edition, got: ${msg}`);
            assert.ok(msg.includes('fips'), `Error should mention fips edition, got: ${msg}`);
        }
    });
});
