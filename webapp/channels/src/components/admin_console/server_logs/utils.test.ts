// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevelEnum, LogNodeKey} from '@mattermost/types/admin';

import type {LogObjectWithAdditionalInfo} from './types';
import {LEVEL_GROUPS, formatLogValue, groupLevels, levelGroup, logRowTimeFormat, logRowTimeLength, logsNeedDate, newestLogTimes, nextDayStart} from './utils';

describe('components/admin_console/server_logs/utils', () => {
    test.each([
        ['a string', 'text', 'text'],
        ['a number', 42, '42'],
        ['a boolean', false, 'false'],
        ['null', null, 'null'],
        ['an object', {plugin: {id: 'x'}}, '{"plugin":{"id":"x"}}'],
        ['an array', ['a', 1], '["a",1]'],
    ])('should format %s', (_, value, expected) => {
        expect(formatLogValue(value)).toBe(expected);
    });

    test.each([
        ['panic', 'error'],
        ['fatal', 'error'],
        ['critical', 'error'],
        ['error', 'error'],
        ['warn', 'warn'],
        ['info', 'info'],
        ['stdlog', 'info'],
        ['debug', 'debug'],
        ['trace', 'debug'],
        ['silly', undefined],
        ['LDAPError', undefined],
    ])('should put the %s level in the %s group', (level, group) => {
        expect(levelGroup(level)).toBe(group);
    });

    test('should list every grouped level exactly once', () => {
        const levels = LEVEL_GROUPS.flatMap(groupLevels);
        expect(new Set(levels).size).toBe(levels.length);
        expect(levels.every((level) => LEVEL_GROUPS.includes(levelGroup(level)!))).toBe(true);
    });

    describe('newestLogTimes', () => {
        function log(node: string, timestamp: string, extra: Partial<LogObjectWithAdditionalInfo> = {}): LogObjectWithAdditionalInfo {
            return {caller: '', job_id: '', level: LogLevelEnum.INFO, msg: '', timestamp, worker: '', [LogNodeKey]: node, ...extra};
        }

        test('should find the newest entry per node, whatever order the entries are in', () => {
            expect(newestLogTimes([
                log('node-a', '2026-10-20 11:00:02.500 +02:00'),
                log('node-a', '2026-10-20 11:00:01.000 +02:00'),
                log('node-b', '2026-10-20 09:00:03.000 Z'),
            ])).toEqual({
                'node-a': Date.UTC(2026, 9, 20, 9, 0, 2, 500),
                'node-b': Date.UTC(2026, 9, 20, 9, 0, 3),
            });
        });

        test('should skip failed node entries and unparsable timestamps', () => {
            expect(newestLogTimes([
                log('node-a', '2026-10-20 09:00:01.000 Z'),
                log('node-a', '2026-10-20 09:05:00.000 Z', {failed_node: true}),
                log('node-a', 'not a time'),
                log('node-b', '2026-10-20 09:05:00.000 Z', {failed_node: true}),
            ])).toEqual({'node-a': Date.UTC(2026, 9, 20, 9, 0, 1)});
        });
    });

    describe('row time format', () => {
        test.each([
            [false, true, 'HH:mm:ss.SSS', 12],
            [false, false, 'h:mm:ss.SSS A', 15],
            [true, true, 'YYYY-MM-DD HH:mm:ss.SSS', 23],
            [true, false, 'YYYY-MM-DD h:mm:ss.SSS A', 26],
        ])('with the date %s and the 24-hour clock %s', (showDate, useMilitaryTime, format, length) => {
            expect(logRowTimeFormat(showDate, useMilitaryTime)).toBe(format);

            expect(logRowTimeLength(format)).toBe(length);
        });
    });

    describe('logsNeedDate', () => {
        const at = (timestamp: string) => ({timestamp, level: LogLevelEnum.INFO, msg: '', caller: ''}) as LogObjectWithAdditionalInfo;
        const now = Date.parse('2026-03-12T18:00:00.000Z');

        test.each([
            ['no entries', [], 'UTC', false],
            ['only entries from today', ['2026-03-12T00:00:00.000Z', '2026-03-12T17:59:59.999Z'], 'UTC', false],
            ['all entries on one earlier day', ['2026-03-10T10:00:00.000Z', '2026-03-10T11:00:00.000Z'], 'UTC', true],
            ['entries from yesterday and today', ['2026-03-11T23:59:59.999Z', '2026-03-12T10:00:00.000Z'], 'UTC', true],
            ['entries that are from today only in the admin\'s timezone', ['2026-03-11T23:30:00.000Z'], 'Europe/Berlin', false],
            ['entries from today in UTC that are yesterday in the admin\'s timezone', ['2026-03-12T02:00:00.000Z'], 'America/New_York', true],
            ['a timestamp that does not parse among today\'s', ['2026-03-12T10:00:00.000Z', 'not a timestamp'], 'UTC', false],
        ])('with %s', (_, timestamps, timezone, expected) => {
            expect(logsNeedDate(timestamps.map(at), timezone, now)).toBe(expected);
        });
    });

    describe('nextDayStart', () => {
        test.each([
            ['UTC', '2026-03-12T18:00:00.000Z', '2026-03-13T00:00:00.000Z'],
            ['Europe/Berlin', '2026-03-12T18:00:00.000Z', '2026-03-12T23:00:00.000Z'],
            ['UTC', '2026-03-12T23:59:59.999Z', '2026-03-13T00:00:00.000Z'],
        ])('in %s at %s', (timezone, now, expected) => {
            expect(nextDayStart(timezone, Date.parse(now))).toBe(Date.parse(expected));
        });
    });
});
