// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {formatAttributeName} from './format_attribute_name';

describe('formatAttributeName', () => {
    test('snake_case to title case', () => {
        expect(formatAttributeName('user_role')).toBe('User Role');
    });

    test('camelCase to title case', () => {
        expect(formatAttributeName('userRole')).toBe('User Role');
    });

    test('leading uppercase does not leave a leading space in output', () => {
        expect(formatAttributeName('Program')).toBe('Program');
    });

    test('preserves acronym runs before a capitalized word', () => {
        expect(formatAttributeName('ABACPolicy')).toBe('Abac Policy');
    });

    test('preserves trailing acronym after camelCase prefix', () => {
        expect(formatAttributeName('userID')).toBe('User Id');
    });
});
