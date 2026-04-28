// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {it} from './admin_definition_helpers';

describe('AdminDefinitionHelpers - stateEqualsOrDefault', () => {
    test('should return true when state value equals expected value', () => {
        const state = {
            'ServiceSettings.BurnOnReadDurationSeconds': '600',
        };

        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadDurationSeconds', '600', '600');
        expect(checker({}, state)).toBe(true);
    });

    test('should return true when state value is null and expected value equals default', () => {
        const state = {
            'ServiceSettings.BurnOnReadDurationSeconds': null,
        };

        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadDurationSeconds', '600', '600');
        expect(checker({}, state)).toBe(true);
    });

    test('should return true when state value is undefined and expected value equals default', () => {
        const state = {};

        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadDurationSeconds', '600', '600');
        expect(checker({}, state)).toBe(true);
    });

    test('should return false for non-matching values', () => {
        const mismatchedState = {'ServiceSettings.BurnOnReadDurationSeconds': '1800'};
        const nullStateWithDifferentExpected = {'ServiceSettings.BurnOnReadDurationSeconds': null};
        const undefinedStateWithDifferentExpected = {};

        // Checking for '300' when state has '1800' should return false
        const checker = it.stateEqualsOrDefault('ServiceSettings.BurnOnReadDurationSeconds', '300', '600');

        expect(checker({}, mismatchedState)).toBe(false);

        // When checking for '300' with default '600', null/undefined should return false
        // because null/undefined would be treated as '600' (the default), not '300'
        expect(checker({}, nullStateWithDifferentExpected)).toBe(false);
        expect(checker({}, undefinedStateWithDifferentExpected)).toBe(false);
    });
});
