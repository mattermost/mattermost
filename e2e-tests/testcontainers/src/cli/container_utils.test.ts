// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {findConfigDiffs, buildPingUrl, validateLocalUrl} from './container_utils';

describe('findConfigDiffs', () => {
    it('returns empty array for identical objects', () => {
        const obj = {a: 1, b: 'hello'};
        assert.deepEqual(findConfigDiffs(obj, {...obj}), []);
    });

    it('detects flat value changes', () => {
        const before = {a: 1, b: 'hello'};
        const after = {a: 2, b: 'hello'};
        const diffs = findConfigDiffs(before, after);
        assert.equal(diffs.length, 1);
        assert.equal(diffs[0].path, 'a');
        assert.equal(diffs[0].before, 1);
        assert.equal(diffs[0].after, 2);
    });

    it('detects nested value changes', () => {
        const before = {section: {key: 'old'}};
        const after = {section: {key: 'new'}};
        const diffs = findConfigDiffs(before, after);
        assert.equal(diffs.length, 1);
        assert.equal(diffs[0].path, 'section.key');
    });

    it('detects added keys', () => {
        const before: Record<string, unknown> = {a: 1};
        const after = {a: 1, b: 2};
        const diffs = findConfigDiffs(before, after);
        assert.equal(diffs.length, 1);
        assert.equal(diffs[0].path, 'b');
        assert.equal(diffs[0].before, undefined);
        assert.equal(diffs[0].after, 2);
    });

    it('detects removed keys', () => {
        const before = {a: 1, b: 2};
        const after: Record<string, unknown> = {a: 1};
        const diffs = findConfigDiffs(before, after);
        assert.equal(diffs.length, 1);
        assert.equal(diffs[0].path, 'b');
        assert.equal(diffs[0].before, 2);
        assert.equal(diffs[0].after, undefined);
    });
});

describe('validateLocalUrl', () => {
    it('accepts http://localhost URLs', () => {
        const parsed = validateLocalUrl('http://localhost:8065');
        assert.equal(parsed.hostname, 'localhost');
        assert.equal(parsed.port, '8065');
    });

    it('accepts http://127.0.0.1 URLs', () => {
        const parsed = validateLocalUrl('http://127.0.0.1:8065');
        assert.equal(parsed.hostname, '127.0.0.1');
    });

    it('accepts localhost with subpath', () => {
        const parsed = validateLocalUrl('http://localhost:8065/mattermost1');
        assert.equal(parsed.hostname, 'localhost');
        assert.equal(parsed.pathname, '/mattermost1');
    });

    it('rejects https protocol', () => {
        assert.throws(() => validateLocalUrl('https://localhost:8065'), /Only http: protocol is allowed/);
    });

    it('rejects non-localhost hostnames', () => {
        assert.throws(() => validateLocalUrl('http://example.com:8065'), /Only localhost URLs are allowed/);
    });

    it('rejects internal network hostnames', () => {
        assert.throws(() => validateLocalUrl('http://192.168.1.1:8065'), /Only localhost URLs are allowed/);
    });

    it('rejects file protocol', () => {
        assert.throws(() => validateLocalUrl('file:///etc/passwd'), /Only http: protocol is allowed/);
    });

    it('rejects invalid URLs', () => {
        assert.throws(() => validateLocalUrl('not-a-url'), /Invalid URL/);
    });
});

describe('buildPingUrl', () => {
    it('appends /api/v4/system/ping to root URL', () => {
        assert.equal(buildPingUrl('http://localhost:8065'), 'http://localhost:8065/api/v4/system/ping');
    });

    it('appends /api/v4/system/ping after subpath', () => {
        assert.equal(
            buildPingUrl('http://localhost:8065/mattermost1'),
            'http://localhost:8065/mattermost1/api/v4/system/ping',
        );
    });

    it('handles trailing slash', () => {
        assert.equal(buildPingUrl('http://localhost:8065/'), 'http://localhost:8065/api/v4/system/ping');
    });

    it('rejects non-localhost URLs', () => {
        assert.throws(() => buildPingUrl('http://non-localhost.com:8065'), /Only localhost URLs are allowed/);
    });
});
