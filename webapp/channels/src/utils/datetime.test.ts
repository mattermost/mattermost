// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

import {
    getDiff,
    getMillisUntilNextDay,
    isToday,
    isYesterday,
} from './datetime';

describe('isToday and isYesterday', () => {
    test('tomorrow at 12am', () => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(0);
        date.setMinutes(0);

        expect(isToday(date)).toBe(false);
        expect(isYesterday(date)).toBe(false);
    });

    test('now', () => {
        const date = new Date();

        expect(isToday(date)).toBe(true);
        expect(isYesterday(date)).toBe(false);
    });

    test('today at 12am', () => {
        const date = new Date();
        date.setHours(0);
        date.setMinutes(0);

        expect(isToday(date)).toBe(true);
        expect(isYesterday(date)).toBe(false);
    });

    test('today at 11:59pm', () => {
        const date = new Date();
        date.setHours(23);
        date.setMinutes(59);

        expect(isToday(date)).toBe(true);
        expect(isYesterday(date)).toBe(false);
    });

    test('yesterday at 11:59pm', () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        date.setHours(23);
        date.setMinutes(59);

        expect(isToday(date)).toBe(false);
        expect(isYesterday(date)).toBe(true);
    });

    test('yesterday at 12am', () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        date.setHours(0);
        date.setMinutes(0);

        expect(isToday(date)).toBe(false);
        expect(isYesterday(date)).toBe(true);
    });

    test('two days ago at 11:59pm', () => {
        const date = new Date();
        date.setDate(date.getDate() - 2);
        date.setHours(23);
        date.setMinutes(59);

        expect(isToday(date)).toBe(false);
        expect(isYesterday(date)).toBe(false);
    });
});

describe('diff: day', () => {
    const tz = '';

    test('tomorrow at 12am', () => {
        const now = new Date();
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(0);
        date.setMinutes(0);

        expect(getDiff(date, now, tz, 'day')).toBe(+1);
    });

    test('now', () => {
        const now = new Date();
        const date = new Date();

        expect(getDiff(date, now, tz, 'day')).toBe(0);
    });

    test('today at 12am', () => {
        const now = new Date();
        const date = new Date();
        date.setHours(0);
        date.setMinutes(0);

        expect(getDiff(date, now, tz, 'day')).toBe(0);
    });

    test('today at 11:59pm', () => {
        const now = new Date();
        const date = new Date();
        date.setHours(23);
        date.setMinutes(59);

        expect(getDiff(date, now, tz, 'day')).toBe(0);
    });

    test('yesterday at 11:59pm', () => {
        const now = new Date();
        const date = new Date();
        date.setDate(date.getDate() - 1);
        date.setHours(23);
        date.setMinutes(59);

        expect(getDiff(date, now, tz, 'day')).toBe(-1);
    });

    test('yesterday at 12am', () => {
        const now = new Date();
        const date = new Date();
        date.setDate(date.getDate() - 1);
        date.setHours(0);
        date.setMinutes(0);

        expect(getDiff(date, now, tz, 'day')).toBe(-1);
    });

    test('two days ago at 11:59pm', () => {
        const now = new Date();
        const date = new Date();
        date.setDate(date.getDate() - 2);
        date.setHours(23);
        date.setMinutes(59);

        expect(getDiff(date, now, tz, 'day')).toBe(-2);
    });

    test('366 days ago at 11:59pm', () => {
        const now = new Date();
        const date = new Date();
        date.setDate(date.getDate() - 366);
        date.setHours(23);
        date.setMinutes(59);

        expect(getDiff(date, now, tz, 'day')).toBe(-366);
    });
});

describe('getMillisUntilNextDay', () => {
    const HOUR = 60 * 60 * 1000;

    test('ten seconds before midnight', () => {
        expect(getMillisUntilNextDay(new Date('2019-05-03T23:59:50Z'), 'UTC')).toBe(10 * 1000);
    });

    // A zero here would schedule a setTimeout(0) that immediately reschedules itself.
    test('exactly at midnight', () => {
        expect(getMillisUntilNextDay(new Date('2019-05-04T00:00:00Z'), 'UTC')).toBe(24 * HOUR);
    });

    test('measured in the given timezone rather than UTC', () => {
        // 08:59:50 on the following day in Tokyo, so its midnight is 15 hours and 10 seconds away.
        expect(getMillisUntilNextDay(new Date('2019-05-03T23:59:50Z'), 'Asia/Tokyo')).toBe((15 * HOUR) + (10 * 1000));
    });

    test('day shortened by the start of daylight saving time', () => {
        // Midnight on the day New York springs forward, which only has 23 hours.
        expect(getMillisUntilNextDay(new Date('2019-03-10T05:00:00Z'), 'America/New_York')).toBe(23 * HOUR);
    });

    test('day lengthened by the end of daylight saving time', () => {
        // Midnight on the day New York falls back, which has 25 hours.
        expect(getMillisUntilNextDay(new Date('2019-11-03T04:00:00Z'), 'America/New_York')).toBe(25 * HOUR);
    });

    test('day that starts an hour late because its midnight never happens', () => {
        // Santiago springs forward at 00:00, so 2019-09-08 begins at 01:00 local time. From
        // 10:00 on the 7th that is 14 hours away rather than the nominal 15.
        expect(getMillisUntilNextDay(new Date('2019-09-07T14:00:00Z'), 'America/Santiago')).toBe(14 * HOUR);
    });

    test('lands on the start of a later local day in every timezone', () => {
        const from = Date.UTC(2019, 0, 1);
        const until = Date.UTC(2031, 0, 1);
        const violations: string[] = [];

        for (const name of moment.tz.names()) {
            const zone = moment.tz.zone(name);

            if (!zone) {
                continue;
            }

            const instants = [from, Date.UTC(2025, 6, 1)];

            // Probe either side of every offset change, which is where the arithmetic can slip.
            for (const transition of zone.untils) {
                if (transition > from && transition < until) {
                    instants.push(transition - 1000, transition, transition + 1000);
                }
            }

            for (const instant of instants) {
                const delay = getMillisUntilNextDay(new Date(instant), name);
                const landing = moment.tz(instant + delay, name);

                if (delay <= 0 || delay > 26 * HOUR) {
                    violations.push(`${name} at ${new Date(instant).toISOString()}: delay of ${delay}ms`);
                } else if (landing.valueOf() !== landing.clone().startOf('day').valueOf()) {
                    violations.push(`${name} at ${new Date(instant).toISOString()}: landed on ${landing.format()}`);
                }
            }
        }

        expect(violations.slice(0, 10)).toEqual([]);
    });
});
