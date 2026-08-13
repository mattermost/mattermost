// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';

import InviteAs, {InviteType} from './invite_as';

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/users') as typeof import('mattermost-redux/selectors/entities/users'),
    isCurrentUserSystemAdmin: () => true,
}));

jest.mock('mattermost-redux/actions/admin', () => ({
    ...jest.requireActual('mattermost-redux/actions/admin') as typeof import('mattermost-redux/actions/admin'),
    getPrevTrialLicense: () => ({type: 'MOCK_GET_PREV_TRIAL_LICENSE'}),
}));

describe('components/cloud_start_trial_btn/cloud_start_trial_btn', () => {
    const THIRTY_DAYS = (60 * 60 * 24 * 30 * 1000);
    const subscriptionCreateAt = Date.now();
    const subscriptionEndAt = subscriptionCreateAt + THIRTY_DAYS;

    const props = {
        setInviteAs: jest.fn(),
        inviteType: InviteType.MEMBER,
        titleClass: 'title',
        canInviteGuests: true,
    };

    const state = {
        entities: {
            admin: {
                prevTrialLicense: {
                    IsLicensed: 'true',
                },
            },
            general: {
                config: {
                    BuildEnterpriseReady: 'true',
                },
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
            users: {
                currentUserId: 'uid',
                profiles: {
                    uid: {},
                },
            },
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <InviteAs {...props}/>,
            state,
            {useMockedStore: true},
        );
        expect(container).toMatchSnapshot();
    });

    test('shows the radio buttons', () => {
        renderWithContext(
            <InviteAs {...props}/>,
            state,
            {useMockedStore: true},
        );
        expect(screen.getAllByRole('radio')).toHaveLength(2);
    });

    test('guest radio-button is disabled and shows the badge guest restricted feature to invite guest when is NOT free trial for cloud', () => {
        const testState = {
            entities: {
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                general: {
                    config: {
                        BuildEnterpriseReady: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                        SkuShortName: CloudProducts.STARTER,
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'false',
                        trial_end_at: 0,
                        sku: CloudProducts.STARTER,
                        product_id: 'cloud-starter-id',
                    },
                    products: {
                        'cloud-starter-id': {
                            sku: CloudProducts.STARTER,
                        },
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        current_user_id: {roles: 'system_admin'},
                    },
                },
            },
        };
        renderWithContext(
            <InviteAs {...props}/>,
            testState,
            {useMockedStore: true},
        );

        const guestRadioButton = screen.getByDisplayValue('GUEST');
        expect(guestRadioButton).toBeDisabled();

        expect(screen.getByText('Professional feature- try it out free')).toBeInTheDocument();
    });

    test('restricted badge shows "Upgrade" for cloud post trial', () => {
        const testState = {
            entities: {
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                general: {
                    config: {
                        BuildEnterpriseReady: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                        SkuShortName: CloudProducts.STARTER,
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'false',
                        trial_end_at: 100000,
                        sku: CloudProducts.STARTER,
                        product_id: 'cloud-starter-id',
                    },
                    products: {
                        'cloud-starter-id': {
                            sku: CloudProducts.STARTER,
                        },
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        current_user_id: {roles: 'system_admin'},
                    },
                },
            },
        };
        renderWithContext(
            <InviteAs {...props}/>,
            testState,
            {useMockedStore: true},
        );

        const guestRadioButton = screen.getByDisplayValue('GUEST');
        expect(guestRadioButton).toBeDisabled();

        expect(screen.getByText('Upgrade')).toBeInTheDocument();
    });

    test('guest radio-button is disabled and shows the badge guest restricted feature to invite guest when is NOT free trial for self hosted starter', () => {
        const testState = {
            entities: {
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                general: {
                    config: {
                        BuildEnterpriseReady: 'true',
                    },
                    license: {
                        IsLicensed: 'false',
                    },
                },
                cloud: {},
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        current_user_id: {roles: 'system_admin'},
                    },
                },
            },
        };
        renderWithContext(
            <InviteAs {...props}/>,
            testState,
            {useMockedStore: true},
        );

        const guestRadioButton = screen.getByDisplayValue('GUEST');
        expect(guestRadioButton).toBeDisabled();

        expect(screen.getByText('Professional feature- try it out free')).toBeInTheDocument();
    });

    test('restricted badge shows "Upgrade" for self hosted starter post trial', () => {
        const testState = {
            entities: {
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'true',
                    },
                },
                general: {
                    config: {
                        BuildEnterpriseReady: 'true',
                    },
                    license: {
                        IsLicensed: 'false',
                    },
                },
                cloud: {},
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        current_user_id: {roles: 'system_admin'},
                    },
                },
            },
        };
        renderWithContext(
            <InviteAs {...props}/>,
            testState,
            {useMockedStore: true},
        );

        const guestRadioButton = screen.getByDisplayValue('GUEST');
        expect(guestRadioButton).toBeDisabled();

        expect(screen.getByText('Upgrade')).toBeInTheDocument();
    });

    test('shows the badge guest highligh feature to invite guest when IS FREE trial for cloud', () => {
        const testState = {
            entities: {
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                general: {
                    config: {
                        BuildEnterpriseReady: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                        SkuShortName: CloudProducts.STARTER,
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                        trial_end_at: subscriptionEndAt,
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        current_user_id: {roles: 'system_admin'},
                    },
                },
            },
        };
        renderWithContext(
            <InviteAs {...props}/>,
            testState,
            {useMockedStore: true},
        );

        const guestRadioButton = screen.getByDisplayValue('GUEST');
        expect(guestRadioButton).not.toBeDisabled();

        expect(screen.getByText('Professional feature')).toBeInTheDocument();
    });

    test('shows the badge guest highligh feature to invite guest when IS FREE trial for self hosted starter', () => {
        const testState = {
            entities: {
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                general: {
                    config: {
                        BuildEnterpriseReady: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        IsTrial: 'true',
                    },
                },
                cloud: {},
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        current_user_id: {roles: 'system_admin'},
                    },
                },
            },
        };
        renderWithContext(
            <InviteAs {...props}/>,
            testState,
            {useMockedStore: true},
        );

        const guestRadioButton = screen.getByDisplayValue('GUEST');
        expect(guestRadioButton).not.toBeDisabled();

        expect(screen.getByText('Professional feature')).toBeInTheDocument();
    });

    test('guest radio-button is disabled when canInviteGuests prop is false', () => {
        const propsWithCanInviteGuestsFalse = {
            ...props,
            canInviteGuests: false,
        };

        // Use a state where normally guests would be allowed (paid subscription)
        const paidState = {
            entities: {
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'true',
                    },
                },
                general: {
                    config: {
                        BuildEnterpriseReady: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                        SkuShortName: 'professional',
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'false',
                        trial_end_at: 0,
                        sku: 'professional',
                        product_id: 'cloud-professional-id',
                    },
                    products: {
                        'cloud-professional-id': {
                            sku: 'professional',
                        },
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {roles: 'system_admin'},
                    },
                },
            },
        };
        renderWithContext(
            <InviteAs {...propsWithCanInviteGuestsFalse}/>,
            paidState,
            {useMockedStore: true},
        );

        const guestRadioButton = screen.getByDisplayValue('GUEST');
        expect(guestRadioButton).toBeDisabled();
    });

    test('guest radio-button is enabled when canInviteGuests prop is true and other conditions allow it', () => {
        const propsWithCanInviteGuestsTrue = {
            ...props,
            canInviteGuests: true,
        };

        // Use a state where guests would be allowed (paid subscription)
        const paidState = {
            entities: {
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'true',
                    },
                },
                general: {
                    config: {
                        BuildEnterpriseReady: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                        SkuShortName: 'professional',
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'false',
                        trial_end_at: 0,
                        sku: 'professional',
                        product_id: 'cloud-professional-id',
                    },
                    products: {
                        'cloud-professional-id': {
                            sku: 'professional',
                        },
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {roles: 'system_admin'},
                    },
                },
            },
        };
        renderWithContext(
            <InviteAs {...propsWithCanInviteGuestsTrue}/>,
            paidState,
            {useMockedStore: true},
        );

        const guestRadioButton = screen.getByDisplayValue('GUEST');
        expect(guestRadioButton).not.toBeDisabled();
    });

    test('guest radio-button is disabled when canInviteGuests prop is undefined and defaults to system behavior', () => {
        // Test with starter plan where guests should be disabled by default
        const testState = {
            entities: {
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                general: {
                    config: {
                        BuildEnterpriseReady: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                        SkuShortName: CloudProducts.STARTER,
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'false',
                        trial_end_at: 0,
                        sku: CloudProducts.STARTER,
                        product_id: 'cloud-starter-id',
                    },
                    products: {
                        'cloud-starter-id': {
                            sku: CloudProducts.STARTER,
                        },
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {roles: 'system_admin'},
                    },
                },
            },
        };
        renderWithContext(
            <InviteAs {...props}/>,
            testState,
            {useMockedStore: true},
        );

        const guestRadioButton = screen.getByDisplayValue('GUEST');
        expect(guestRadioButton).toBeDisabled();
    });
});
