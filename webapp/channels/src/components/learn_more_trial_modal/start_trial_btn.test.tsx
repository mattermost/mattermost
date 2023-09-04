// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactWrapper} from 'enzyme';
import {shallow} from 'enzyme';
import React from 'react';
import {act} from 'react-dom/test-utils';
import {Provider} from 'react-redux';

import StartTrialBtn from 'components/learn_more_trial_modal/start_trial_btn';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

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
}));

jest.mock('actions/admin_actions', () => ({
    ...jest.requireActual('actions/admin_actions'),
    requestTrialLicense: (requestedUsers: number) => {
        if (requestedUsers === 9001) {
            return {type: 'asdf', data: null, error: {status: 400, message: 'some error'}};
        } else if (requestedUsers === 451) {
            return {type: 'asdf', data: {status: 451}, error: {message: 'some error'}};
        }
        return {type: 'asdf', data: 'ok'};
    },
}));

describe('components/learn_more_trial_modal/start_trial_btn', () => {
    const state = {
        entities: {
            users: {
                currentUserId: 'current_user_id',
            },
            admin: {
                analytics: {
                    TOTAL_USERS: 9,
                },
                prevTrialLicense: {
                    IsLicensed: 'false',
                },
            },
            general: {
                license: {
                    IsLicensed: 'false',
                },
                config: {
                    TelemetryId: 'test_telemetry_id',
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    learn_more_trial_modal: {
                        open: 'true',
                    },
                },
            },
        },
    };

    const store = mockStore(state);

    const props = {
        onClick: jest.fn(),
        message: 'Start trial',
        telemetryId: 'test_telemetry_id',
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <StartTrialBtn {...props}/>
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should handle on click', async () => {
        const mockOnClick = jest.fn();

        let wrapper: ReactWrapper<any>;

        // Mount the component
        await act(async () => {
            wrapper = mountWithIntl(
                <Provider store={store}>
                    <StartTrialBtn
                        {...props}
                        onClick={mockOnClick}
                    />
                </Provider>,
            );
        });

        await act(async () => {
            wrapper.find('.start-trial-btn').simulate('click');
        });

        expect(mockOnClick).toHaveBeenCalled();
    });

    test('should handle on click when rendered as button', async () => {
        const mockOnClick = jest.fn();

        let wrapper: ReactWrapper<any>;

        // Mount the component
        await act(async () => {
            wrapper = mountWithIntl(
                <Provider store={store}>
                    <StartTrialBtn
                        {...props}
                        renderAsButton={true}
                        onClick={mockOnClick}
                    />
                </Provider>,
            );
        });

        await act(async () => {
            wrapper.find('button').simulate('click');
        });

        expect(mockOnClick).toHaveBeenCalled();
    });

    // test('does not show success for embargoed countries', async () => {
    //     const mockOnClick = jest.fn();

    //     let wrapper: ReactWrapper<any>;
    //     const clonedState = JSON.parse(JSON.stringify(state));
    //     clonedState.entities.admin.analytics.TOTAL_USERS = 451;

    //     // Mount the component
    //     await act(async () => {
    //         wrapper = mountWithIntl(
    //             <Provider store={mockStore(clonedState)}>
    //                 <StartTrialBtn
    //                     {...props}
    //                     onClick={mockOnClick}
    //                 />
    //             </Provider>,
    //         );
    //     });

    //     await act(async () => {
    //         wrapper.find('.start-trial-btn').simulate('click');
    //     });

    //     expect(mockOnClick).not.toHaveBeenCalled();
    // });
});
