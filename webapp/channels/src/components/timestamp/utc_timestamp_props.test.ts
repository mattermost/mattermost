// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {formatUtcTimestamp, UTC_TIMESTAMP_PROPS} from './utc_timestamp_props';

describe('formatUtcTimestamp', () => {
    test('should format as ISO date with 24-hour UTC time', () => {
        expect(formatUtcTimestamp(1577836800000)).toBe('2020-01-01 00:00 UTC');
        expect(formatUtcTimestamp(1577880000000)).toBe('2020-01-01 12:00 UTC');
    });
});

describe('UTC_TIMESTAMP_PROPS', () => {
    test('should configure absolute UTC formatting without locale date order', () => {
        expect(UTC_TIMESTAMP_PROPS).toMatchObject({
            timeZone: 'UTC',
            useRelative: false,
            useDate: false,
            useTime: false,
        });
        expect(UTC_TIMESTAMP_PROPS.children).toBeDefined();
        expect(formatUtcTimestamp(1577836800000)).toBe('2020-01-01 00:00 UTC');
    });
});
