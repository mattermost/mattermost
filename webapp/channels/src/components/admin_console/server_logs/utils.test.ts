// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {formatLogValue} from './utils';

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
});
