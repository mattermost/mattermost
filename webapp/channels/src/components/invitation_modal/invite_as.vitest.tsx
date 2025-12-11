// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {CloudProducts} from 'utils/constants';

import InviteAs, {InviteType} from './invite_as';

vi.mock('mattermost-redux/selectors/entities/users', async () => {
    const actual = await vi.importActual('mattermost-redux/selectors/entities/users');
    return {
        ...actual,
        isCurrentUserSystemAdmin: () => true,
    };
});

describe('components/cloud_start_trial_btn/cloud_start_trial_btn', () => {
    const THIRTY_DAYS = (60 * 60 * 24 * 30 * 1000); // in milliseconds
    const subscriptionCreateAt = Date.now();
    const subscriptionEndAt = subscriptionCreateAt + THIRTY_DAYS;

    const props = {
        setInviteAs: vi.fn(),
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
        );
        expect(container).toMatchSnapshot();
    });

    test('shows the radio buttons', () => {
        renderWithContext(
            <InviteAs {...props}/>,
            state,
        );

        // RadioGroup renders radio buttons for invite type selection
        // Look for both Member and Guest radio buttons
        expect(screen.getByRole('radio', {name: /member/i})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: /guest/i})).toBeInTheDocument();
    });

    test('guest radio-button is disabled and shows the badge guest restricted feature to invite guest when is NOT free trial for cloud', () => {
        const cloudStarterState = {
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
            cloudStarterState,
        );

        const guestRadioButton = screen.getByRole('radio', {name: /guest/i});
        expect(guestRadioButton).toBeDisabled();

        expect(screen.getByText('Professional feature- try it out free')).toBeInTheDocument();
    });

    test('restricted badge shows "Upgrade" for cloud post trial', () => {
        const cloudPostTrialState = {
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
            cloudPostTrialState,
        );

        const guestRadioButton = screen.getByRole('radio', {name: /guest/i});
        expect(guestRadioButton).toBeDisabled();

        expect(screen.getByText('Upgrade')).toBeInTheDocument();
    });

    test('guest radio-button is disabled and shows the badge guest restricted feature to invite guest when is NOT free trial for self hosted starter', () => {
        const selfHostedStarterState = {
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
            selfHostedStarterState,
        );

        const guestRadioButton = screen.getByRole('radio', {name: /guest/i});
        expect(guestRadioButton).toBeDisabled();

        expect(screen.getByText('Professional feature- try it out free')).toBeInTheDocument();
    });

    test('restricted badge shows "Upgrade" for self hosted starter post trial', () => {
        const selfHostedPostTrialState = {
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
            selfHostedPostTrialState,
        );

        const guestRadioButton = screen.getByRole('radio', {name: /guest/i});
        expect(guestRadioButton).toBeDisabled();

        expect(screen.getByText('Upgrade')).toBeInTheDocument();
    });

    test('shows the badge guest highligh feature to invite guest when IS FREE trial for cloud', () => {
        const cloudFreeTrialState = {
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
            cloudFreeTrialState,
        );

        const guestRadioButton = screen.getByRole('radio', {name: /guest/i});
        expect(guestRadioButton).not.toBeDisabled();

        expect(screen.getByText('Professional feature')).toBeInTheDocument();
    });

    test('shows the badge guest highligh feature to invite guest when IS FREE trial for self hosted starter', () => {
        const selfHostedFreeTrialState = {
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
            selfHostedFreeTrialState,
        );

        const guestRadioButton = screen.getByRole('radio', {name: /guest/i});
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
        );

        const guestRadioButton = screen.getByRole('radio', {name: /guest/i});
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
        );

        const guestRadioButton = screen.getByRole('radio', {name: /guest/i});
        expect(guestRadioButton).not.toBeDisabled();
    });

    test('guest radio-button is disabled when canInviteGuests prop is undefined and defaults to system behavior', () => {
        // Test with starter plan where guests should be disabled by default
        const starterState = {
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
            starterState,
        );

        const guestRadioButton = screen.getByRole('radio', {name: /guest/i});
        expect(guestRadioButton).toBeDisabled();
    });
});
