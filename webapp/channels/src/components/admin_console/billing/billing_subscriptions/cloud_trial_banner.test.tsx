// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {shallow} from 'enzyme';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import mockStore from 'tests/test_store';
import {CloudBanners, Preferences} from 'utils/constants';

import CloudTrialBanner from './cloud_trial_banner';

jest.mock('components/common/hooks/useOpenSalesLink', () => ({
    __esModule: true,
    default: () => () => true,
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

    const store = mockStore(state);

    test('should match snapshot when no trial end date is passed', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <CloudTrialBanner trialEndDate={0}/>
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when is cloud and is free trial (the trial end is passed)', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <CloudTrialBanner trialEndDate={12345}/>
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
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

        const store = mockStore(stateWithPref);
        const wrapper = shallow(
            <Provider store={store}>
                <CloudTrialBanner trialEndDate={12345}/>
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
