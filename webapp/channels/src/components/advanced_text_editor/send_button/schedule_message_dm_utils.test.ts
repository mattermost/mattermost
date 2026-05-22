// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import moment from 'moment-timezone';

import {
    formatTimezoneOffsetShort,
    getTheirMorningTimestamp,
    hasRecipientTimezone,
    reinterpretWallClock,
} from './schedule_message_dm_utils';

describe('schedule_message_dm_utils', () => {
    describe('hasRecipientTimezone', () => {
        it('returns false when timezone is missing', () => {
            expect(hasRecipientTimezone({} as never)).toBe(false);
            expect(hasRecipientTimezone(undefined)).toBe(false);
        });

        it('returns true when timezone is set', () => {
            expect(hasRecipientTimezone({
                timezone: {
                    useAutomaticTimezone: 'true',
                    automaticTimezone: 'America/New_York',
                    manualTimezone: '',
                },
            } as never)).toBe(true);
        });
    });

    describe('getTheirMorningTimestamp', () => {
        const tz = 'America/New_York';

        it('returns today at 9am on weekday before 9am', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 21, hour: 8}, {zone: tz});
            const result = DateTime.fromMillis(getTheirMorningTimestamp(tz, now)).setZone(tz);

            expect(result.toFormat('yyyy-MM-dd HH:mm')).toBe('2025-05-21 09:00');
        });

        it('returns next weekday at 9am after 9am on weekday', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 21, hour: 10}, {zone: tz});
            const result = DateTime.fromMillis(getTheirMorningTimestamp(tz, now)).setZone(tz);

            expect(result.toFormat('yyyy-MM-dd HH:mm')).toBe('2025-05-22 09:00');
        });

        it('skips weekend from Friday evening', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 23, hour: 18}, {zone: tz});
            const result = DateTime.fromMillis(getTheirMorningTimestamp(tz, now)).setZone(tz);

            expect(result.weekday).toBe(1);
            expect(result.toFormat('yyyy-MM-dd HH:mm')).toBe('2025-05-26 09:00');
        });

        it('returns Monday 9am from Saturday', () => {
            const now = DateTime.fromObject({year: 2025, month: 5, day: 24, hour: 12}, {zone: tz});
            const result = DateTime.fromMillis(getTheirMorningTimestamp(tz, now)).setZone(tz);

            expect(result.toFormat('yyyy-MM-dd HH:mm')).toBe('2025-05-26 09:00');
        });
    });

    describe('reinterpretWallClock', () => {
        it('preserves wall clock values when changing timezone', () => {
            const original = moment.tz('2025-05-22 09:00', 'America/New_York');
            const reinterpreted = reinterpretWallClock(original, 'Europe/London');

            expect(reinterpreted.format('YYYY-MM-DD HH:mm')).toBe('2025-05-22 09:00');
            expect(reinterpreted.tz()).toBe('Europe/London');
        });
    });

    describe('formatTimezoneOffsetShort', () => {
        it('formats whole-hour offsets', () => {
            const at = moment.tz('2025-01-15 12:00', 'Europe/London');
            expect(formatTimezoneOffsetShort('Europe/London', at)).toMatch(/^UTC[+-]\d+$/);
        });
    });
});
