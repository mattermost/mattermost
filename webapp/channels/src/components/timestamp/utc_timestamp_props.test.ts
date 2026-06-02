// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {formatIsoTimestamp, formatUtcTimestamp, UTC_TIMESTAMP_PROPS} from './utc_timestamp_props';

describe('formatIsoTimestamp', () => {
    test('should format as ISO 8601 date-time with explicit UTC offset', () => {
        expect(formatIsoTimestamp(1577836800000)).toBe('2020-01-01T00:00:00+00:00');
        expect(formatIsoTimestamp(1577880000000)).toBe('2020-01-01T12:00:00+00:00');
    });

    test('formatUtcTimestamp is an alias for formatIsoTimestamp', () => {
        expect(formatUtcTimestamp(1577836800000)).toBe('2020-01-01T00:00:00+00:00');
    });
});

describe('UTC_TIMESTAMP_PROPS', () => {
    test('should configure ISO timestamp formatting in UTC', () => {
        expect(UTC_TIMESTAMP_PROPS).toMatchObject({
            timeZone: 'UTC',
            useRelative: false,
            useDate: false,
            useTime: false,
        });
        expect(UTC_TIMESTAMP_PROPS.children).toBeDefined();
    });
});
