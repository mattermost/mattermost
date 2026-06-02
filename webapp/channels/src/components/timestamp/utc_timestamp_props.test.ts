// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {formatIsoTimestamp, getIsoTimestampProps} from './utc_timestamp_props';

describe('formatIsoTimestamp', () => {
    test('should format as ISO 8601 date-time with explicit UTC offset', () => {
        expect(formatIsoTimestamp(1577836800000, 'UTC')).toBe('2020-01-01T00:00:00+00:00');
        expect(formatIsoTimestamp(1577880000000, 'UTC')).toBe('2020-01-01T12:00:00+00:00');
    });

    test('should use the provided timezone offset', () => {
        expect(formatIsoTimestamp(1577836800000, 'Europe/Berlin')).toBe('2020-01-01T01:00:00+01:00');
    });
});

describe('getIsoTimestampProps', () => {
    test('should configure ISO timestamp formatting for the user timezone', () => {
        const props = getIsoTimestampProps('Europe/Berlin');

        expect(props).toMatchObject({
            timeZone: 'Europe/Berlin',
            useRelative: false,
            useDate: false,
            useTime: false,
        });
        expect(formatIsoTimestamp(1577836800000, 'Europe/Berlin')).toBe('2020-01-01T01:00:00+01:00');
    });
});
