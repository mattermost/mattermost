// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactWrapper} from 'enzyme';
import {shallow} from 'enzyme';
import React from 'react';
import {act} from 'react-dom/test-utils';
import {Provider} from 'react-redux';

import * as cloudActions from 'actions/cloud';
import {trackEvent} from 'actions/telemetry_actions.jsx';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {TELEMETRY_CATEGORIES} from 'utils/constants';

import CloudStartTrialButton from './cloud_start_trial_btn';

jest.mock('actions/telemetry_actions.jsx', () => {
    const original = jest.requireActual('actions/telemetry_actions.jsx');
    return {
        ...original,
        trackEvent: jest.fn(),
    };
});

jest.mock('mattermost-redux/actions/general', () => ({
    ...jest.requireActual('mattermost-redux/actions/general'),
    getLicenseConfig: () => ({type: 'adsf'}),
    getClientConfig: () => ({type: 'adsf'}),
}));

jest.mock('mattermost-redux/actions/cloud', () => ({
    ...jest.requireActual('mattermost-redux/actions/cloud'),
    getCloudSubscription: () => ({type: 'adsf'}),
    getCloudProducts: () => ({type: 'adsf'}),
    getCloudLimits: () => ({}),
}));

describe('components/cloud_start_trial_btn/cloud_start_trial_btn', () => {
    const state = {
        entities: {
            admin: {},
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
            },
            cloud: {
                subscription: {
                    is_free_trial: 'false',
                    trial_end_at: 0,
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    learn_more_trial_modal: {
                        open: true,
                    },
                },
            },
        },
    };

    const store = mockStore(state);

    const props = {
        onClick: jest.fn(),
        message: 'Cloud Start trial',
        telemetryId: 'test_telemetry_id',
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <CloudStartTrialButton {...props}/>
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should handle on click and change button text on SUCCESSFUL trial request', async () => {
        const mockOnClick = jest.fn();
        const requestTrialFn: () => () => Promise<any> = () => () => Promise.resolve(true);
        jest.spyOn(cloudActions, 'requestCloudTrial').mockImplementation(requestTrialFn);

        let wrapper: ReactWrapper<any>;

        // Mount the component
        await act(async () => {
            wrapper = mountWithIntl(
                <Provider store={store}>
                    <CloudStartTrialButton
                        {...props}
                        onClick={mockOnClick}
                        email='fakeemail@topreventbusinessemailvalidation'
                    />
                </Provider>,
            );
        });

        await act(async () => {
            expect(wrapper.find('.CloudStartTrialButton').text().includes('Cloud Start trial')).toBe(true);
            wrapper.find('.CloudStartTrialButton').simulate('click');
        });

        await act(async () => {
            expect(wrapper.find('.CloudStartTrialButton').text().includes('Loaded!')).toBe(true);
        });

        expect(mockOnClick).toHaveBeenCalled();

        expect(trackEvent).toHaveBeenCalledWith(TELEMETRY_CATEGORIES.CLOUD_START_TRIAL_BUTTON, 'test_telemetry_id');
    });

    test('should handle on click and change button text on FAILED trial request', async () => {
        const mockOnClick = jest.fn();
        const requestTrialFn: () => () => Promise<any> = () => () => Promise.resolve(true);
        jest.spyOn(cloudActions, 'requestCloudTrial').mockImplementation(requestTrialFn);

        let wrapper: ReactWrapper<any>;

        // Mount the component
        await act(async () => {
            wrapper = mountWithIntl(
                <Provider store={store}>
                    <CloudStartTrialButton
                        {...props}
                        onClick={mockOnClick}
                    />
                </Provider>,
            );
        });

        await act(async () => {
            expect(wrapper.find('.CloudStartTrialButton').text().includes('Cloud Start trial')).toBe(true);
        });

        await act(async () => {
            wrapper.find('.CloudStartTrialButton').simulate('click');
        });

        await act(async () => {
            expect(wrapper.find('.CloudStartTrialButton').text().includes('Failed')).toBe(true);
        });
    });
});
