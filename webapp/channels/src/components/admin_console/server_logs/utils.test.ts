// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevelEnum, LogNodeKey} from '@mattermost/types/admin';

import type {LogObjectWithAdditionalInfo} from './types';
import {formatLogValue, newestLogTimes} from './utils';

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
});
