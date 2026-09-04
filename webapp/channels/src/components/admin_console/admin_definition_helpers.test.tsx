// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {it, validators} from './admin_definition_helpers';

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

describe('AdminDefinitionHelpers - licensedForAddOn', () => {
    const checker = it.licensedForAddOn('crossguard');

    test('should return false when unlicensed', () => {
        expect(checker({}, {}, {IsLicensed: 'false', AddOns: 'crossguard'})).toBe(false);
        expect(checker({}, {}, undefined)).toBe(false);
    });

    test('should return false when licensed without any add-ons', () => {
        expect(checker({}, {}, {IsLicensed: 'true'})).toBe(false);
        expect(checker({}, {}, {IsLicensed: 'true', AddOns: ''})).toBe(false);
    });

    test('should return true when the add-on is granted', () => {
        expect(checker({}, {}, {IsLicensed: 'true', AddOns: 'crossguard'})).toBe(true);
    });

    test('should return true when the add-on is one of several', () => {
        expect(checker({}, {}, {IsLicensed: 'true', AddOns: 'other,crossguard,another'})).toBe(true);
    });

    test('should not match on a substring', () => {
        // A future 'crossguard-premium' add-on must not satisfy 'crossguard'.
        expect(checker({}, {}, {IsLicensed: 'true', AddOns: 'crossguard-premium'})).toBe(false);
        expect(checker({}, {}, {IsLicensed: 'true', AddOns: 'cross'})).toBe(false);
    });

    test('should match case-insensitively', () => {
        expect(checker({}, {}, {IsLicensed: 'true', AddOns: 'CrossGuard'})).toBe(true);
    });
});

describe('AdminDefinitionHelpers - validators.numberInRange', () => {
    const validate = validators.numberInRange(0, 60, 'out of range');

    test('should return valid for in-range numbers', () => {
        expect(validate(0).isValid()).toBe(true);
        expect(validate(30).isValid()).toBe(true);
        expect(validate(60).isValid()).toBe(true);
    });

    test('should return invalid for out-of-range numbers', () => {
        expect(validate(-1).isValid()).toBe(false);
        expect(validate(61).isValid()).toBe(false);
    });

    test('should return valid for NaN since the server backfills empty inputs with defaults', () => {
        expect(validate(NaN).isValid()).toBe(true);
    });
});
