// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {buildQueryString, extractFilenameFromContentDisposition} from './helpers';

describe('Helpers', () => {
    test.each([
        [{}, ''],
        [{a: 1}, '?a=1'],
        [{a: 1, b: 'str'}, '?a=1&b=str'],
        [{a: 1, b: 'str', c: undefined}, '?a=1&b=str'],
        [{a: 1, b: 'str', c: 0}, '?a=1&b=str&c=0'],
        [{a: 1, b: 'str', c: ''}, '?a=1&b=str&c='],
        [{a: 1, b: undefined, c: 'str'}, '?a=1&c=str'],
    ])('buildQueryString with %o should return %s', (params, expected) => {
        expect(buildQueryString(params)).toEqual(expected);
    });

    describe('extractFilenameFromContentDisposition', () => {
        const fallback = 'fallback.csv';

        test.each([
            ['attachment; filename="report.csv"', 'report.csv'],
            ['attachment; filename=report.csv', 'report.csv'],
            ["attachment; filename='report.csv'", 'report.csv'],

            // Documents a known limitation: RFC 5987 filename* values stop at the charset
            // delimiter. No Mattermost endpoint emits filename*, so this is left as-is.
            ["attachment; filename*=UTF-8''report.csv", 'UTF-8'],

            ['attachment; filename="post-exposure-abc123-1700000000000.csv"', 'post-exposure-abc123-1700000000000.csv'],
            ['inline', fallback],
            ['', fallback],
            [null, fallback],
            [undefined, fallback],
        ])('with header %p should return %p', (header, expected) => {
            expect(extractFilenameFromContentDisposition(header, fallback)).toEqual(expected);
        });
    });
});
