// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    formatIsoTimestamp,
    formatOffsetTimestamp,
    formatUtcOffsetLabel,
    getOffsetTimestampProps,
    getTimestampDisplayProps,
} from './timestamp_display_props';

describe('formatUtcOffsetLabel', () => {
    test('should format whole-hour offsets without minutes', () => {
        expect(formatUtcOffsetLabel('+01:00')).toBe('UTC+01');
        expect(formatUtcOffsetLabel('-05:00')).toBe('UTC-05');
    });

    test('should preserve fractional offsets', () => {
        expect(formatUtcOffsetLabel('+05:30')).toBe('UTC+05:30');
    });
});

describe('formatIsoTimestamp', () => {
    test('should format as ISO 8601 date-time with explicit offset', () => {
        expect(formatIsoTimestamp(1577836800000, 'UTC')).toBe('2020-01-01T00:00:00+00:00');
        expect(formatIsoTimestamp(1577836800000, 'Europe/Berlin')).toBe('2020-01-01T01:00:00+01:00');
    });
});

describe('formatOffsetTimestamp', () => {
    test('should format as date at time with UTC offset label', () => {
        expect(formatOffsetTimestamp(1577836800000, 'Europe/Berlin')).toBe('2020-01-01 at 01:00:00 (UTC+01)');
    });
});

describe('getTimestampDisplayProps', () => {
    test('should return undefined for default mode', () => {
        expect(getTimestampDisplayProps('UTC', 'default')).toBeUndefined();
    });

    test('should return offset props for offset mode', () => {
        const props = getOffsetTimestampProps('Europe/Berlin');
        expect(props.timeZone).toBe('Europe/Berlin');
        expect(formatOffsetTimestamp(1577836800000, 'Europe/Berlin')).toBe('2020-01-01 at 01:00:00 (UTC+01)');
    });
});
