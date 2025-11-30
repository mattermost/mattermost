// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import FeatureRestrictedModal from './feature_restricted_modal';

describe('components/global/product_switcher_menu', () => {
    const defaultProps = {
        titleAdminPreTrial: 'Title admin pre trial',
        messageAdminPreTrial: 'Message admin pre trial',
        titleAdminPostTrial: 'Title admin post trial',
        messageAdminPostTrial: 'Message admin post trial',
        titleEndUser: 'Title end user',
        messageEndUser: 'Message end user',
    };

    const initialState = {
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
                        open: true,
                    },
                },
            },
        },
    };

    test('should show with end user pre trial', () => {
        const {baseElement} = renderWithContext(
            <FeatureRestrictedModal {...defaultProps}/>,
            initialState,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should show with end user post trial', () => {
        const {baseElement} = renderWithContext(
            <FeatureRestrictedModal {...defaultProps}/>,
            initialState,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should show with system admin pre trial for self hosted', () => {
        const stateWithAdmin = {
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    ...initialState.entities.users,
                    profiles: {
                        ...initialState.entities.users.profiles,
                        user1: {
                            id: 'user1',
                            roles: 'system_admin',
                        },
                    },
                },
            },
        };

        const {baseElement} = renderWithContext(
            <FeatureRestrictedModal {...defaultProps}/>,
            stateWithAdmin,
        );

        expect(baseElement).toMatchSnapshot();
    });
});
