// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Preferences} from '../constants';
import {getEmailInterval} from 'mattermost-redux/utils/notify_props';

describe('user utils', () => {
    const testCases = [
        {enableEmail: false, enableBatching: true, intervalPreference: Preferences.INTERVAL_IMMEDIATE, out: Preferences.INTERVAL_NEVER},

        {enableEmail: true, enableBatching: true, intervalPreference: undefined as any, out: Preferences.INTERVAL_FIFTEEN_MINUTES},
        {enableEmail: true, enableBatching: true, intervalPreference: Preferences.INTERVAL_IMMEDIATE, out: Preferences.INTERVAL_IMMEDIATE},
        {enableEmail: true, enableBatching: true, intervalPreference: Preferences.INTERVAL_NEVER, out: Preferences.INTERVAL_IMMEDIATE},
        {enableEmail: true, enableBatching: true, intervalPreference: Preferences.INTERVAL_FIFTEEN_MINUTES, out: Preferences.INTERVAL_FIFTEEN_MINUTES},
        {enableEmail: true, enableBatching: true, intervalPreference: Preferences.INTERVAL_HOUR, out: Preferences.INTERVAL_HOUR},

        {enableEmail: true, enableBatching: false, intervalPreference: undefined as any, out: Preferences.INTERVAL_IMMEDIATE},
        {enableEmail: true, enableBatching: false, intervalPreference: Preferences.INTERVAL_IMMEDIATE, out: Preferences.INTERVAL_IMMEDIATE},
        {enableEmail: true, enableBatching: false, intervalPreference: Preferences.INTERVAL_NEVER, out: Preferences.INTERVAL_IMMEDIATE},
        {enableEmail: true, enableBatching: false, intervalPreference: Preferences.INTERVAL_FIFTEEN_MINUTES, out: Preferences.INTERVAL_IMMEDIATE},
        {enableEmail: true, enableBatching: false, intervalPreference: Preferences.INTERVAL_HOUR, out: Preferences.INTERVAL_IMMEDIATE},
    ];

    testCases.forEach((testCase) => {
        it(`getEmailInterval should return correct interval: getEmailInterval(${testCase.enableEmail}, ${testCase.enableBatching}, ${testCase.intervalPreference}) should return ${testCase.out}`, () => {
            expect(getEmailInterval(testCase.enableEmail, testCase.enableBatching, testCase.intervalPreference)).toEqual(testCase.out);
        });
    });
});
