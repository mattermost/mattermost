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
            ['attachment; filename="post-exposure-abc123-1700000000000.csv"', 'post-exposure-abc123-1700000000000.csv'],

            // An unquoted value ends at the parameter separator, with or without surrounding space.
            ['attachment; filename=report.csv; size=1', 'report.csv'],
            ['attachment; filename=report.csv;size=1', 'report.csv'],
            ['attachment; filename = report.csv ; size=1', 'report.csv'],

            // A quoted value may contain the separator and escaped quotes.
            ['attachment; filename="report; final.csv"', 'report; final.csv'],
            ['attachment; filename="say \\"hi\\".csv"', 'say "hi".csv'],

            // RFC 5987 extended values are percent-decoded, and preferred over plain filename.
            ["attachment; filename*=UTF-8''report.csv", 'report.csv'],
            ["attachment; filename*=UTF-8''report%20name.csv", 'report name.csv'],
            ["attachment; filename=ascii.csv; filename*=UTF-8''unicode%E2%9C%93.csv", 'unicode✓.csv'],
            ["attachment; filename*=UTF-8''report.csv; size=1", 'report.csv'],

            // An undecodable or malformed extended value falls through to plain filename, then fallback.
            ["attachment; filename=ascii.csv; filename*=UTF-8''%E0%A4%A.csv", 'ascii.csv'],
            ['attachment; filename*=no-charset-delimiters', fallback],
            ["attachment; filename*=UTF-8''%E0%A4%A.csv", fallback],

            ['attachment; filename=', fallback],
            ['attachment; filename=""', fallback],
            ['inline', fallback],
            ['', fallback],
            [null, fallback],
            [undefined, fallback],
        ])('with header %p should return %p', (header, expected) => {
            expect(extractFilenameFromContentDisposition(header, fallback)).toEqual(expected);
        });
    });
});
