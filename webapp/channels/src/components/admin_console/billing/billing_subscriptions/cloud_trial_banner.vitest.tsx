// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {CloudBanners, Preferences} from 'utils/constants';

import CloudTrialBanner from './cloud_trial_banner';

vi.mock('components/common/hooks/useOpenSalesLink', () => ({
    default: () => [vi.fn()],
}));

describe('components/admin_console/billing_subscription/CloudTrialBanner', () => {
    const state = {
        entities: {
            users: {
                currentUserId: 'test_id',
            },
            admin: {
                prevTrialLicense: {
                    IsLicensed: 'false',
                },
            },
            general: {
                license: {
                    IsLicensed: 'false',
                },
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    test('should match snapshot when no trial end date is passed', () => {
        const {container} = renderWithContext(
            <CloudTrialBanner trialEndDate={0}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when is cloud and is free trial (the trial end is passed)', () => {
        const {container} = renderWithContext(
            <CloudTrialBanner trialEndDate={12345}/>,
            state,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when there is an stored preference value', () => {
        const myPref = {
            myPreferences: {
                [getPreferenceKey(Preferences.CLOUD_TRIAL_BANNER, CloudBanners.UPGRADE_FROM_TRIAL)]: {
                    category: Preferences.CLOUD_TRIAL_BANNER,
                    name: CloudBanners.UPGRADE_FROM_TRIAL,
                    value: new Date().getTime().toString(),
                },
            },
        };

        const stateWithPref = {...state, entities: {...state.entities, preferences: myPref}};

        const {container} = renderWithContext(
            <CloudTrialBanner trialEndDate={12345}/>,
            stateWithPref,
        );
        expect(container).toMatchSnapshot();
    });
});
