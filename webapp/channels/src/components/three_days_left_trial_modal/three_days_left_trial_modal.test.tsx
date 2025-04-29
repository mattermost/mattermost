// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import ThreeDaysLeftTrialModal from 'components/three_days_left_trial_modal/three_days_left_trial_modal';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

describe('components/three_days_left_trial_modal/three_days_left_trial_modal', () => {
    // required state to mount using the provider
    const user = TestHelper.fakeUserWithId();

    const profiles = {
        [user.id]: user,
    };

    const state = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
            },
            cloud: {
                limits: {
                    limitsLoaded: true,
                },
            },
            users: {
                currentUserId: user.id,
                profiles,
            },
            usage: {
                files: {
                    totalStorage: 0,
                    totalStorageLoaded: true,
                },
                messages: {
                    history: 0,
                    historyLoaded: true,
                },
                boards: {
                    cards: 0,
                    cardsLoaded: true,
                },
                integrations: {
                    enabled: 3,
                    enabledLoaded: true,
                },
                teams: {
                    active: 0,
                    cloudArchived: 0,
                    teamsLoaded: true,
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    three_days_left_trial_modal: {
                        open: true,
                    },
                },
            },
        },
    };

    const props = {
        onExited: jest.fn(),
        limitsOverpassed: false,
    };

    const store = mockStore(state);

    test('should match snapshot', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <ThreeDaysLeftTrialModal {...props}/>
            </Provider>,
        );
        expect(wrapper.debug()).toMatchSnapshot();
    });

    test('should match snapshot when limits are overpassed and show the limits panel', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <ThreeDaysLeftTrialModal
                    {...props}
                    limitsOverpassed={true}
                />
            </Provider>,
        );
        expect(wrapper.debug()).toMatchSnapshot();
    });

    test('should show the three days left modal with the three cards', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ThreeDaysLeftTrialModal {...props}/>
            </Provider>,
        );

        expect(wrapper.find('ThreeDaysLeftTrialModal ThreeDaysLeftTrialCard')).toHaveLength(3);
    });

    test('should show the workspace limits panel when limits are overpassed', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ThreeDaysLeftTrialModal
                    {...props}
                    limitsOverpassed={true}
                />
            </Provider>,
        );
        expect(wrapper.find('ThreeDaysLeftTrialModal WorkspaceLimitsPanel')).toHaveLength(1);
    });

    test('should call on exited', () => {
        const mockOnExited = jest.fn();

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ThreeDaysLeftTrialModal
                    {...props}
                    onExited={mockOnExited}
                />
            </Provider>,
        );

        wrapper.find(GenericModal).props().onExited?.();

        expect(mockOnExited).toHaveBeenCalled();
    });
});
