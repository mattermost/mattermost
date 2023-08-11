// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {ModalIdentifiers} from 'utils/constants';

import FeatureRestrictedModal from './feature_restricted_modal';

const mockDispatch = jest.fn();
let mockState: any;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/global/product_switcher_menu', () => {
    const defaultProps = {
        titleAdminPreTrial: 'Title admin pre trial',
        messageAdminPreTrial: 'Message admin pre trial',
        titleAdminPostTrial: 'Title admin post trial',
        messageAdminPostTrial: 'Message admin post trial',
        titleEndUser: 'Title end user',
        messageEndUser: 'Message end user',
    };

    beforeEach(() => {
        mockState = {
            entities: {
                users: {
                    currentUserId: 'user1',
                    profiles: {
                        current_user_id: {roles: ''},
                        user1: {
                            id: 'user1',
                            roles: '',
                        },
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
                cloud: {
                    subscription: {
                        id: 'subId',
                        customer_id: '',
                        product_id: '',
                        add_ons: [],
                        start_at: 0,
                        end_at: 0,
                        create_at: 0,
                        seats: 0,
                        trial_end_at: 0,
                        is_free_trial: '',
                    },
                },
            },
            views: {
                modals: {
                    modalState: {
                        [ModalIdentifiers.FEATURE_RESTRICTED_MODAL]: {
                            open: 'true',
                        },
                    },
                },
            },
        };
    });

    test('should show with end user pre trial', () => {
        const wrapper = shallow(<FeatureRestrictedModal {...defaultProps}/>);

        expect(wrapper.find('.FeatureRestrictedModal__description').text()).toEqual(defaultProps.messageEndUser);
        expect(wrapper.find('.FeatureRestrictedModal__terms').length).toEqual(0);
        expect(wrapper.find('.FeatureRestrictedModal__buttons').hasClass('single')).toEqual(true);
        expect(wrapper.find('.button-plans').length).toEqual(1);
        expect(wrapper.find('CloudStartTrialButton').length).toEqual(0);
        expect(wrapper.find('StartTrialBtn').length).toEqual(0);
    });

    test('should show with end user post trial', () => {
        const wrapper = shallow(<FeatureRestrictedModal {...defaultProps}/>);

        expect(wrapper.find('.FeatureRestrictedModal__description').text()).toEqual(defaultProps.messageEndUser);
        expect(wrapper.find('.FeatureRestrictedModal__terms').length).toEqual(0);
        expect(wrapper.find('.FeatureRestrictedModal__buttons').hasClass('single')).toEqual(true);
        expect(wrapper.find('.button-plans').length).toEqual(1);
        expect(wrapper.find('CloudStartTrialButton').length).toEqual(0);
        expect(wrapper.find('StartTrialBtn').length).toEqual(0);
    });

    test('should show with system admin pre trial for self hosted', () => {
        mockState.entities.users.profiles.user1.roles = 'system_admin';

        const wrapper = shallow(<FeatureRestrictedModal {...defaultProps}/>);

        expect(wrapper.find('.FeatureRestrictedModal__description').text()).toEqual(defaultProps.messageAdminPreTrial);
        expect(wrapper.find('.FeatureRestrictedModal__terms').length).toEqual(1);
        expect(wrapper.find('.FeatureRestrictedModal__buttons').hasClass('single')).toEqual(false);
        expect(wrapper.find('.button-plans').length).toEqual(1);
        expect(wrapper.find('StartTrialBtn').length).toEqual(1);
    });

    test('should show with system admin pre trial for cloud', () => {
        mockState.entities.users.profiles.user1.roles = 'system_admin';
        mockState.entities.general.license = {
            Cloud: 'true',
        };

        const wrapper = shallow(<FeatureRestrictedModal {...defaultProps}/>);

        expect(wrapper.find('.FeatureRestrictedModal__description').text()).toEqual(defaultProps.messageAdminPreTrial);
        expect(wrapper.find('.FeatureRestrictedModal__terms').length).toEqual(1);
        expect(wrapper.find('.FeatureRestrictedModal__buttons').hasClass('single')).toEqual(false);
        expect(wrapper.find('.button-plans').length).toEqual(1);
        expect(wrapper.find('CloudStartTrialButton').length).toEqual(1);
    });

    test('should match snapshot with system admin post trial', () => {
        mockState.entities.users.profiles.user1.roles = 'system_admin';
        mockState.entities.cloud.subscription.is_free_trial = 'false';
        mockState.entities.cloud.subscription.trial_end_at = 1;

        const wrapper = shallow(<FeatureRestrictedModal {...defaultProps}/>);

        expect(wrapper.find('.FeatureRestrictedModal__description').text()).toEqual(defaultProps.messageAdminPostTrial);
        expect(wrapper.find('.FeatureRestrictedModal__terms').length).toEqual(0);
        expect(wrapper.find('.button-plans').length).toEqual(1);
        expect(wrapper.find('CloudStartTrialButton').length).toEqual(0);
    });
});
