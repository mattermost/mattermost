// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
});
