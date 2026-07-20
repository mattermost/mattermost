// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {renderWithContext} from 'tests/react_testing_utils';
import {CloudBanners, Preferences} from 'utils/constants';

import CloudTrialBanner from './cloud_trial_banner';

jest.mock('components/common/hooks/useOpenSalesLink', () => ({
    __esModule: true,
    default: () => [jest.fn()],
}));

const mockDispatch = jest.fn();
let mockState: any;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/admin_console/billing_subscription/CloudTrialBanner', () => {
    const state = {
        entities: {
            users: {
                currentUserId: 'test_id',
                profiles: {
                    test_id: {id: 'test_id', roles: 'system_user'},
                },
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
        mockState = state;
        const {container} = renderWithContext(
            <CloudTrialBanner trialEndDate={0}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when is cloud and is free trial (the trial end is passed)', () => {
        mockState = state;
        const {container} = renderWithContext(
            <CloudTrialBanner trialEndDate={12345}/>,
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

        mockState = {...state, entities: {...state.entities, preferences: myPref}};
        const {container} = renderWithContext(
            <CloudTrialBanner trialEndDate={12345}/>,
        );
        expect(container).toMatchSnapshot();
    });
});
