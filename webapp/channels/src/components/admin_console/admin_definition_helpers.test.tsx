// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {it} from './admin_definition_helpers';

describe('AdminDefinitionHelpers - stateEqualsOrDefault', () => {
    test('should return true when state value equals expected value', () => {
        const state = {
            'ServiceSettings.BurnOnReadAllowedUsers': 'all',
        };

        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadAllowedUsers', 'all', 'all');
        expect(checker({}, state)).toBe(true);
    });

    test('should return true when state value is null and expected value equals default', () => {
        const state = {
            'ServiceSettings.BurnOnReadAllowedUsers': null,
        };

        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadAllowedUsers', 'all', 'all');
        expect(checker({}, state)).toBe(true);
    });

    test('should return true when state value is undefined and expected value equals default', () => {
        const state = {};

        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadAllowedUsers', 'all', 'all');
        expect(checker({}, state)).toBe(true);
    });

    test('should return false for non-matching values', () => {
        const mismatchedState = {'ServiceSettings.BurnOnReadAllowedUsers': 'block_selected'};
        const nullStateWithDifferentExpected = {'ServiceSettings.BurnOnReadAllowedUsers': null};
        const undefinedStateWithDifferentExpected = {};

        // Checking for 'allow_selected' when state has 'block_selected' should return false
        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadAllowedUsers', 'allow_selected', 'all');

        expect(checker({}, mismatchedState)).toBe(false);

        // When checking for 'allow_selected' with default 'all', null/undefined should return false
        // because null/undefined would be treated as 'all' (the default), not 'allow_selected'
        expect(checker({}, nullStateWithDifferentExpected)).toBe(false);
        expect(checker({}, undefinedStateWithDifferentExpected)).toBe(false);
    });
});
