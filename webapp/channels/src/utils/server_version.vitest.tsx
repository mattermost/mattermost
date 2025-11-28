// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isServerVersionGreaterThanOrEqualTo} from 'utils/server_version';

describe('utils/server_version/isServerVersionGreaterThanOrEqualTo', () => {
    test('should consider two empty versions as equal', () => {
        const a = '';
        const b = '';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
    });

    test('should consider different strings without components as equal', () => {
        const a = 'not a server version';
        const b = 'also not a server version';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
    });

    test('should consider different malformed versions normally (not greater than case)', () => {
        const a = '1.2.3';
        const b = '1.2.4';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(false);
    });

    test('should consider different malformed versions normally (greater than case)', () => {
        const a = '1.2.4';
        const b = '1.2.3';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
    });

    test('should work correctly for  different numbers of digits', () => {
        const a = '10.0.1';
        const b = '4.8.0';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
    });

    test('should consider an empty version as not greater than or equal', () => {
        const a = '';
        const b = '4.7.1.dev.c51676437bc02ada78f3a0a0a2203c60.true';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(false);
    });

    test('should consider the same versions equal', () => {
        const a = '4.7.1.dev.c51676437bc02ada78f3a0a0a2203c60.true';
        const b = '4.7.1.dev.c51676437bc02ada78f3a0a0a2203c60.true';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
    });

    test('should consider different release versions (not greater than case)', () => {
        const a = '4.7.0.12.c51676437bc02ada78f3a0a0a2203c60.true';
        const b = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c60.true';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(false);
    });

    test('should consider different release versions (greater than case)', () => {
        const a = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c60.true';
        const b = '4.7.0.12.c51676437bc02ada78f3a0a0a2203c60.true';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
    });

    test('should consider different build numbers unequal', () => {
        const a = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c60.true';
        const b = '4.7.1.13.c51676437bc02ada78f3a0a0a2203c60.true';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(false);
    });

    test('should ignore different config hashes', () => {
        const a = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c60.true';
        const b = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c61.true';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
    });

    test('should ignore different licensed statuses', () => {
        const a = '4.7.1.13.c51676437bc02ada78f3a0a0a2203c60.false';
        const b = '4.7.1.12.c51676437bc02ada78f3a0a0a2203c60.true';
        expect(isServerVersionGreaterThanOrEqualTo(a, b)).toEqual(true);
    });
});
