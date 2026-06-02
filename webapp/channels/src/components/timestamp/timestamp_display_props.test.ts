// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    formatFullTimestamp,
    formatIsoTimestamp,
    getFullTimestampProps,
    getTimestampDisplayProps,
} from './timestamp_display_props';

describe('formatIsoTimestamp', () => {
    test('should format as ISO 8601 date-time with explicit offset', () => {
        expect(formatIsoTimestamp(1577836800000, 'UTC')).toBe('2020-01-01T00:00:00+00:00');
        expect(formatIsoTimestamp(1577836800000, 'Europe/Berlin')).toBe('2020-01-01T01:00:00+01:00');
    });
});

describe('formatFullTimestamp', () => {
    test('should format as date at time without timezone offset', () => {
        expect(formatFullTimestamp(1577836800000, 'UTC')).toBe('2020-01-01 at 00:00:00');
        expect(formatFullTimestamp(1577836800000, 'Europe/Berlin')).toBe('2020-01-01 at 01:00:00');
    });
});

describe('getTimestampDisplayProps', () => {
    test('should return undefined for default mode', () => {
        expect(getTimestampDisplayProps('UTC', 'default')).toBeUndefined();
    });

    test('should return full timestamp props for full mode', () => {
        const props = getFullTimestampProps('Europe/Berlin');
        expect(props.timeZone).toBe('Europe/Berlin');
        expect(formatFullTimestamp(1577836800000, 'Europe/Berlin')).toBe('2020-01-01 at 01:00:00');
    });
});
