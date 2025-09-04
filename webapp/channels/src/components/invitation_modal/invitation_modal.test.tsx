// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';
import {Provider} from 'react-redux';

import type {Team} from '@mattermost/types/teams';

import {General} from 'mattermost-redux/constants';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {SelfHostedProducts} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';
import {generateId} from 'utils/utils';

import InvitationModal, {View} from './invitation_modal';
import type {Props} from './invitation_modal';
import InviteView from './invite_view';
import NoPermissionsView from './no_permissions_view';
import ResultView from './result_view';

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
        },
    };

    const store = mockStore(state);

    beforeEach(() => {
        props = defaultProps;
    });

    it('shows invite view when view state is invite', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <InvitationModal {...props}/>
            </Provider>,
        );
        expect(wrapper.find(InviteView).length).toBe(1);
    });

    it('shows result view when view state is result', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <InvitationModal {...props}/>
            </Provider>,
        );
        wrapper.find(InvitationModal).at(0).setState({view: View.RESULT});

        wrapper.update();
        expect(wrapper.find(ResultView).length).toBe(1);
    });

    it('shows no permissions view when user can neither invite users nor guests', () => {
        props = {
            ...props,
            canAddUsers: false,
            canInviteGuests: false,
        };
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <InvitationModal {...props}/>
            </Provider>,
        );

        expect(wrapper.find(NoPermissionsView).length).toBe(1);
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

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <InvitationModal {...props}/>
            </Provider>,
        );

        // Get the component instance with proper typing
        const instance = wrapper.find(InvitationModal).instance() as InvitationModal;

        // Set invite type to GUEST
        instance.setState({
            invite: {
                ...instance.state.invite,
                inviteType: 'GUEST',
            },
        });

        // Call channelsLoader with empty search term
        const guestChannels = await instance.channelsLoader('');

        // Verify only non-policy-enforced channels are returned for guests
        expect(guestChannels.length).toBe(1);
        expect(guestChannels[0].id).toBe('regular-channel');

        // Set invite type to MEMBER
        instance.setState({
            invite: {
                ...instance.state.invite,
                inviteType: 'MEMBER',
            },
        });

        // Call channelsLoader with empty search term
        const memberChannels = await instance.channelsLoader('');

        // Verify all channels are returned for members
        expect(memberChannels.length).toBe(2);

        // Test with search term
        instance.setState({
            invite: {
                ...instance.state.invite,
                inviteType: 'GUEST',
            },
        });

        // Call channelsLoader with search term that matches both channels
        const guestChannelsWithSearch = await instance.channelsLoader('channel');

        // Verify only non-policy-enforced channels are returned for guests
        expect(guestChannelsWithSearch.length).toBe(1);
        expect(guestChannelsWithSearch[0].id).toBe('regular-channel');
    });
});
