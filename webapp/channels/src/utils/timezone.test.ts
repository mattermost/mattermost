// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getUtcOffsetForTimeZone} from './timezone';

describe('getUtcOffsetForTimeZone', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    // These zones changed rules in 2026 and require moment-timezone data from IANA TZDB 2026d or later
    test.each([
        ['America/Vancouver', -8 * 60, -7 * 60],
        ['America/Edmonton', -7 * 60, -6 * 60],
        ['America/Inuvik', -7 * 60, -6 * 60],
        ['Africa/Casablanca', 60, 0],
    ])('should use the 2026 rules for %s', (timezone, offsetBefore, offsetAfter) => {
        jest.useFakeTimers();

        jest.setSystemTime(new Date('2025-11-15T12:00:00.000Z'));
        expect(getUtcOffsetForTimeZone(timezone)).toBe(offsetBefore);

        jest.setSystemTime(new Date('2026-11-15T12:00:00.000Z'));
        expect(getUtcOffsetForTimeZone(timezone)).toBe(offsetAfter);
    });
});
