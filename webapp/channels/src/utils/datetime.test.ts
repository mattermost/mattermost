// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getDiff,
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
