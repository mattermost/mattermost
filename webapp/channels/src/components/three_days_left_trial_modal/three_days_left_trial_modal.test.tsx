// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Provider} from 'react-redux';

import {shallow} from 'enzyme';

import ThreeDaysLeftTrialModal from 'components/three_days_left_trial_modal/three_days_left_trial_modal';
import {GenericModal} from '@mattermost/components';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import TestHelper from 'packages/mattermost-redux/test/test_helper';

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
            users: {
                currentUserId: user.id,
                profiles,
            },
        },
        views: {
            modals: {
                modalState: {
                    three_days_left_trial_modal: {
                        open: 'true',
                    },
                },
            },
        },
    };

    const props = {
        onExited: jest.fn(),
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

    test('should show the three days left modal with the three cards', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <ThreeDaysLeftTrialModal {...props}/>
            </Provider>,
        );

        expect(wrapper.find('ThreeDaysLeftTrialModal ThreeDaysLeftTrialCard')).toHaveLength(3);
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

        wrapper.find(GenericModal).props().onExited();

        expect(mockOnExited).toHaveBeenCalled();
    });
});
