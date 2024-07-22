// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';
import {Provider} from 'react-redux';

import type {Team} from '@mattermost/types/teams';

import {General} from 'mattermost-redux/constants';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {mountWithThemedIntl} from 'tests/helpers/themed-intl-test-helper';
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
        const wrapper = mountWithThemedIntl(
            <Provider store={store}>
                <InvitationModal {...props}/>
            </Provider>,
        );
        expect(wrapper.find(InviteView).length).toBe(1);
    });

    it('shows result view when view state is result', () => {
        const wrapper = mountWithThemedIntl(
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
        const wrapper = mountWithThemedIntl(
            <Provider store={store}>
                <InvitationModal {...props}/>
            </Provider>,
        );

        expect(wrapper.find(NoPermissionsView).length).toBe(1);
    });
});
