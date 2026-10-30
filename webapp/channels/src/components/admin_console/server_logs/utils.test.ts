// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LEVEL_GROUPS, formatLogValue, groupLevels, levelGroup} from './utils';

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
});
