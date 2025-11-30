// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {SelfHostedProducts} from 'utils/constants';
import {TestHelper as TH} from 'utils/test_helper';
import {generateId} from 'utils/utils';

import {InviteType} from './invite_as';
import InviteView from './invite_view';
import type {Props} from './invite_view';

const defaultProps: Props = deepFreeze({
    setInviteAs: vi.fn(),
    inviteType: InviteType.MEMBER,
    titleClass: 'title',

    invite: vi.fn(),
    onChannelsChange: vi.fn(),
    onChannelsInputChange: vi.fn(),
    onClose: vi.fn(),
    currentTeam: {} as Team,
    currentChannel: {
        display_name: 'some_channel',
    },
    setCustomMessage: vi.fn(),
    toggleCustomMessage: vi.fn(),
    channelsLoader: vi.fn(),
    regenerateTeamInviteId: vi.fn(),
    isAdmin: false,
    usersLoader: vi.fn(),
    onChangeUsersEmails: vi.fn(),
    isCloud: false,
    emailInvitationsEnabled: true,
    onUsersInputChange: vi.fn(),
    headerClass: '',
    footerClass: '',
    canInviteGuests: true,
    canAddUsers: true,

    customMessage: {
        message: '',
        open: false,
    },
    sending: false,
    inviteChannels: {
        channels: [],
        search: '',
    },
    usersEmails: [],
    usersEmailsSearch: '',
    townSquareDisplayName: '',
    canInviteGuestsWithMagicLink: false,
    useGuestMagicLink: false,
    toggleGuestMagicLink: vi.fn(),
});

let props = defaultProps;

describe('InviteView', () => {
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
                    Id: generateId(),
                },
            },
            cloud: {
                subscription: {
                    is_free_trial: 'false',
                    trial_end_at: 0,
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_user'},
                },
            },
            roles: {
                roles: {
                    system_user: {
                        permissions: [],
                    },
                },
            },
            preferences: {
                myPreferences: {},
            },
            hostedCustomer: {
                products: {
                    productsLoaded: true,
                    products: {
                        prod_professional: TH.getProductMock({
                            id: 'prod_professional',
                            name: 'Professional',
                            sku: SelfHostedProducts.PROFESSIONAL,
                            price_per_seat: 7.5,
                        }),
                    },
                },
            },
        },
    };

    beforeEach(() => {
        props = defaultProps;
    });

    it('shows InviteAs component when user can choose to invite guests or users', async () => {
        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        // InviteAs shows the radio buttons for choosing member vs guest
        expect(screen.getByRole('radio', {name: /member/i})).toBeInTheDocument();
    });

    it('hides InviteAs component when user can not choose members option', async () => {
        props = {
            ...defaultProps,
            canAddUsers: false,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        // RadioGroup should not be present when only one option is available
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('hides InviteAs component when user can not choose guests option', async () => {
        props = {
            ...defaultProps,
            canInviteGuests: false,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        // RadioGroup should not be present when only one option is available
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('shows guest magic link checkbox when inviting guests and guest magic link is enabled', async () => {
        props = {
            ...defaultProps,
            inviteType: InviteType.GUEST,
            canInviteGuestsWithMagicLink: true,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        const checkbox = screen.getByTestId('InviteView__guestMagicLinkCheckbox');
        expect(checkbox).toBeInTheDocument();
    });

    it('hides guest magic link checkbox when inviting members', async () => {
        props = {
            ...defaultProps,
            inviteType: InviteType.MEMBER,
            canInviteGuestsWithMagicLink: true,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        expect(screen.queryByTestId('InviteView__guestMagicLinkCheckbox')).not.toBeInTheDocument();
    });

    it('hides guest magic link checkbox when guest magic link is not enabled', async () => {
        props = {
            ...defaultProps,
            inviteType: InviteType.GUEST,
            canInviteGuestsWithMagicLink: false,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        expect(screen.queryByTestId('InviteView__guestMagicLinkCheckbox')).not.toBeInTheDocument();
    });

    it('calls toggleGuestMagicLink when checkbox is clicked', async () => {
        const toggleGuestMagicLink = vi.fn();
        props = {
            ...defaultProps,
            inviteType: InviteType.GUEST,
            canInviteGuestsWithMagicLink: true,
            toggleGuestMagicLink,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        const checkbox = screen.getByTestId('InviteView__guestMagicLinkCheckbox');
        fireEvent.click(checkbox);

        expect(toggleGuestMagicLink).toHaveBeenCalledTimes(1);
    });
});
