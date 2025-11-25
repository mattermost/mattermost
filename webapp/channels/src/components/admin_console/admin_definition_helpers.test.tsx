// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {it} from './admin_definition_helpers';

describe('AdminDefinitionHelpers - stateEqualsOrDefault', () => {
    test('should return true when state value equals expected value', () => {
        const state = {
            'ServiceSettings.BurnOnReadDurationMinutes': '10',
        };

        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadDurationMinutes', '10', '10');
        expect(checker({}, state)).toBe(true);
    });

    test('should return true when state value is null and expected value equals default', () => {
        const state = {
            'ServiceSettings.BurnOnReadDurationMinutes': null,
        };

        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadDurationMinutes', '10', '10');
        expect(checker({}, state)).toBe(true);
    });

    test('should return true when state value is undefined and expected value equals default', () => {
        const state = {};

        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadDurationMinutes', '10', '10');
        expect(checker({}, state)).toBe(true);
    });

    test('should return false for non-matching values', () => {
        const mismatchedState = {'ServiceSettings.BurnOnReadDurationMinutes': '30'};
        const nullStateWithDifferentExpected = {'ServiceSettings.BurnOnReadDurationMinutes': null};
        const undefinedStateWithDifferentExpected = {};

        // Checking for '5' when state has '30' should return false
        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadDurationMinutes', '5', '10');

        expect(checker({}, mismatchedState)).toBe(false);

        // When checking for '5' with default '10', null/undefined should return false
        // because null/undefined would be treated as '10' (the default), not '5'
        expect(checker({}, nullStateWithDifferentExpected)).toBe(false);
        expect(checker({}, undefinedStateWithDifferentExpected)).toBe(false);
    });
});
