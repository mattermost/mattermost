// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlShape} from 'react-intl';

import {Provider} from 'react-redux';

import store from 'stores/redux_store.jsx';
import {mountWithThemedIntl} from 'tests/helpers/themed-intl-test-helper';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';
import {Team} from '@mattermost/types/teams';
import {generateId} from 'utils/utils';

import ResultView from './result_view';
import InviteView from './invite_view';
import NoPermissionsView from './no_permissions_view';
import InvitationModal, {Props, View, InvitationModal as BaseInvitationModal} from './invitation_modal';

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
        },
    };

    store.getState = () => (state);

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
        wrapper.find(BaseInvitationModal).at(0).setState({view: View.RESULT});

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
