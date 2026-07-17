// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {General} from 'mattermost-redux/constants';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {renderWithContext, screen, act, waitFor} from 'tests/react_testing_utils';
import {SelfHostedProducts} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';
import {generateId} from 'utils/utils';

import InvitationModal, {View} from './invitation_modal';
import type {Props} from './invitation_modal';

const defaultProps: Props = deepFreeze({
    actions: {
        searchChannels: jest.fn(),
        regenerateTeamInviteId: jest.fn(),

        searchProfiles: jest.fn(),
        sendGuestsInvites: jest.fn(),
        sendMembersInvites: jest.fn(),
        sendMembersInvitesToChannels: jest.fn(),
    },
    currentTeam: {
        display_name: '',
    } as Team,
    currentChannel: {
        display_name: '',
    },
    invitableChannels: [],
    emailInvitationsEnabled: true,
    isAdmin: false,
    isCloud: false,
    canAddUsers: true,
    canInviteGuests: true,
    canInviteGuestsWithMagicLink: false,
    intl: {} as IntlShape,
    townSquareDisplayName: '',
    onExited: jest.fn(),
    roleForTrackFlow: {started_by_role: General.SYSTEM_USER_ROLE},
    focusOriginElement: 'elementId',
});

let props = defaultProps;

describe('InvitationModal', () => {
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
                        prod_professional: TestHelper.getProductMock({
                            id: 'prod_professional',
                            name: 'Professional',
                            sku: SelfHostedProducts.PROFESSIONAL,
                            price_per_seat: 7.5,
                        }),
                    },
                },
            },
            limits: {
                serverLimits: {},
            },
        },
    };

    beforeEach(() => {
        props = defaultProps;
    });

    it('shows invite view when view state is invite', () => {
        renderWithContext(
            <InvitationModal {...props}/>,
            state,
        );
        expect(screen.getByTestId('inviteButton')).toBeInTheDocument();
    });

    it('shows result view when view state is result', () => {
        const ref = React.createRef<InvitationModal>();

        renderWithContext(
            <InvitationModal
                {...props}
                ref={ref}
            />,
            state,
        );

        act(() => {
            ref.current!.setState({view: View.RESULT});
        });

        expect(screen.getByTestId('confirm-done')).toBeInTheDocument();
    });

    it('shows no permissions view when user can neither invite users nor guests', () => {
        props = {
            ...props,
            canAddUsers: false,
            canInviteGuests: false,
        };
        renderWithContext(
            <InvitationModal {...props}/>,
            state,
        );

        expect(screen.getByTestId('confirm-done')).toBeInTheDocument();
    });

    it('filters out policy_enforced channels when inviting guests', async () => {
        // Create test channels with and without policy_enforced flag
        const regularChannel = TestHelper.getChannelMock({
            id: 'regular-channel',
            display_name: 'Regular Channel',
            name: 'regular-channel',
            policy_enforced: false,
        });

        const policyEnforcedChannel = TestHelper.getChannelMock({
            id: 'policy-enforced-channel',
            display_name: 'Policy Enforced Channel',
            name: 'policy-enforced-channel',
            policy_enforced: true,
        });

        props = {
            ...props,
            invitableChannels: [regularChannel, policyEnforcedChannel],
        };

        const ref = React.createRef<InvitationModal>();

        renderWithContext(
            <InvitationModal
                {...props}
                ref={ref}
            />,
            state,
        );

        // Get the component instance with proper typing
        const instance = ref.current!;

        // Set invite type to GUEST
        act(() => {
            instance.setState({
                invite: {
                    ...instance.state.invite,
                    inviteType: 'GUEST',
                },
            });
        });

        // Call channelsLoader with empty search term
        const guestChannels = await instance.channelsLoader('');

        // Verify only non-policy-enforced channels are returned for guests
        expect(guestChannels.length).toBe(1);
        expect(guestChannels[0].id).toBe('regular-channel');

        // Set invite type to MEMBER
        act(() => {
            instance.setState({
                invite: {
                    ...instance.state.invite,
                    inviteType: 'MEMBER',
                },
            });
        });

        // Call channelsLoader with empty search term
        const memberChannels = await instance.channelsLoader('');

        // Verify all channels are returned for members
        expect(memberChannels.length).toBe(2);

        // Test with search term
        act(() => {
            instance.setState({
                invite: {
                    ...instance.state.invite,
                    inviteType: 'GUEST',
                },
            });
        });

        // Call channelsLoader with search term that matches both channels
        const guestChannelsWithSearch = await instance.channelsLoader('channel');

        // Verify only non-policy-enforced channels are returned for guests
        expect(guestChannelsWithSearch.length).toBe(1);
        expect(guestChannelsWithSearch[0].id).toBe('regular-channel');
    });

    it('keeps permission-only-policy channels selectable for guest invites', async () => {
        // Bug-fix regression: a channel with ONLY a permission policy (e.g.
        // upload_file_attachment) has policy_enforced=true but no membership
        // action. The server-side guest-invite gate in
        // prepareInviteGuestsToChannels reads policy_actions.membership, and
        // the client must do the same — otherwise guest invites silently
        // drop channels the backend would happily accept.
        const regularChannel = TestHelper.getChannelMock({
            id: 'regular-channel',
            display_name: 'Regular Channel',
            name: 'regular-channel',
            policy_enforced: false,
        });
        const permissionOnlyChannel = TestHelper.getChannelMock({
            id: 'permission-only-channel',
            display_name: 'Permission Only Channel',
            name: 'permission-only-channel',
            policy_enforced: true,
            policy_actions: {upload_file_attachment: true},
        });

        const localProps = {
            ...props,
            invitableChannels: [regularChannel, permissionOnlyChannel],
        };

        const ref = React.createRef<InvitationModal>();
        renderWithContext(
            <InvitationModal
                {...localProps}
                ref={ref}
            />,
            state,
        );
        const instance = ref.current!;

        act(() => {
            instance.setState({
                invite: {
                    ...instance.state.invite,
                    inviteType: 'GUEST',
                },
            });
        });

        const guestChannels = await instance.channelsLoader('');
        expect(guestChannels.map((c) => c.id)).toEqual(
            expect.arrayContaining(['regular-channel', 'permission-only-channel']),
        );
        expect(guestChannels.length).toBe(2);
    });

    it('loads only policy-matching candidates for a private governed team and filters them by term', async () => {
        const matching = [
            TestHelper.getUserMock({id: 'u_eng', username: 'engineer'}),
            TestHelper.getUserMock({id: 'u_mkt', username: 'marketer'}),
        ];
        const spy = jest.spyOn(Client4, 'getProfilesMatchingTeamPolicy').mockResolvedValue(matching);

        const localProps = {
            ...props,
            currentTeam: {id: 'team1', display_name: 'Team One', policy_enforced: true, allow_open_invite: false, type: 'I'} as Team,
        };
        const ref = React.createRef<InvitationModal>();
        renderWithContext(
            <InvitationModal
                {...localProps}
                ref={ref}
            />,
            state,
        );

        await waitFor(() => expect(spy).toHaveBeenCalledWith('team1', expect.any(Number), ''));

        const instance = ref.current!;
        await waitFor(() => expect(instance.state.abacCandidates).toHaveLength(2));

        const results: UserProfile[] = await new Promise((resolve) => {
            instance.usersLoader('engineer', resolve);
        });
        expect(results.map((u) => u.id)).toEqual(['u_eng']);

        spy.mockRestore();
    });

    it('does not hard-filter candidates for a non-governed team', () => {
        const spy = jest.spyOn(Client4, 'getProfilesMatchingTeamPolicy');

        const localProps = {
            ...props,
            currentTeam: {id: 'team1', display_name: 'Team One'} as Team,
        };
        renderWithContext(
            <InvitationModal {...localProps}/>,
            state,
        );

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('does not hard-filter candidates for a public governed team (advisory)', () => {
        const spy = jest.spyOn(Client4, 'getProfilesMatchingTeamPolicy');

        const localProps = {
            ...props,
            currentTeam: {id: 'team1', display_name: 'Team One', policy_enforced: true, allow_open_invite: true, type: 'O'} as Team,
        };
        renderWithContext(
            <InvitationModal {...localProps}/>,
            state,
        );

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
