// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import type {UsersState} from '@mattermost/types/users';

import Permissions from 'mattermost-redux/constants/permissions';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import type {GlobalState} from 'types/store';

import AddChannelsCtaButton from './add_channels_cta_button';

jest.mock('actions/telemetry_actions.jsx', () => {
    const original = jest.requireActual('actions/telemetry_actions.jsx');
    return {
        ...original,
        trackEvent: jest.fn(),
    };
});

const mockDispatch = jest.fn();
let mockState: GlobalState;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/new_channel_modal', () => {
    beforeEach(() => {
        mockState = {
            entities: {
                general: {
                    config: {},
                },
                channels: {
                    currentChannelId: 'current_channel_id',
                    channels: {},
                    roles: {
                        current_channel_id: [
                            'channel_user',
                            'channel_admin',
                        ],
                    },
                },
                teams: {
                    currentTeamId: 'current_team_id',
                    myMembers: {
                        current_team_id: {
                            roles: 'team_user team_admin',
                        },
                    },
                    teams: {
                        current_team_id: {
                            id: 'current_team_id',
                            description: 'Curent team description',
                            name: 'current-team',
                        },
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {roles: 'system_user'},
                    },
                },
                roles: {
                    roles: {
                        guest_user: {
                            permissions: [],
                        },
                        system_user: {
                            permissions: [Permissions.JOIN_PUBLIC_CHANNELS, Permissions.CREATE_PRIVATE_CHANNEL, Permissions.CREATE_PUBLIC_CHANNEL],
                        },
                        system_user_join_permissions: {
                            permissions: [Permissions.JOIN_PUBLIC_CHANNELS],
                        },
                        system_user_create_public_permissions: {
                            permissions: [Permissions.JOIN_PUBLIC_CHANNELS, Permissions.CREATE_PUBLIC_CHANNEL],
                        },
                    },
                },
            },
            views: {
                addChannelCtaDropdown: {
                    isOpen: false,
                },
            },
        } as unknown as GlobalState;
    });

    test('should match snapshot', () => {
        expect(
            shallow(
                <AddChannelsCtaButton/>,
            ),
        ).toMatchSnapshot();
    });

    test('should match snapshot when user has only join channel permissions', () => {
        const userWithJoinChannelsPermission = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {
                    id: 'current_user_id',
                    roles: 'system_user_join_permissions',
                },
            },
        } as unknown as UsersState;
        mockState = {...mockState, entities: {...mockState.entities, users: userWithJoinChannelsPermission}};

        expect(
            shallow(
                <AddChannelsCtaButton/>,
            ),
        ).toMatchSnapshot();
    });

    test('should find the add channels button when user has permissions', () => {
        const wrapper = mountWithIntl(
            <AddChannelsCtaButton/>,
        );
        expect(wrapper.find('.AddChannelsCtaDropdown').exists()).toBeTruthy();
    });

    test('should return nothing when user does not have permissions', () => {
        const guestUser = {
            currentUserId: 'guest_user_id',
            profiles: {
                user_id: {
                    id: 'guest_user_id',
                    roles: 'team_role',
                },
            },
        } as unknown as UsersState;
        mockState = {...mockState, entities: {...mockState.entities, users: guestUser}};

        const wrapper = mountWithIntl(
            <AddChannelsCtaButton/>,
        );
        expect(wrapper.find('.AddChannelsCtaDropdown').exists()).toBeFalsy();
    });

    test('should fire dispatch to save preferences when button is clicked', () => {
        const wrapper = mountWithIntl(
            <AddChannelsCtaButton/>,
        );
        const button = wrapper.find('.AddChannelsCtaDropdown button');
        expect(mockDispatch).not.toHaveBeenCalled();
        button.simulate('click');
        expect(mockDispatch).toHaveBeenCalled();
    });

    test('should fire trackEvent to send telemetry when button is clicked', () => {
        const wrapper = mountWithIntl(
            <AddChannelsCtaButton/>,
        );

        const button = wrapper.find('.AddChannelsCtaDropdown button');
        expect(mockDispatch).not.toHaveBeenCalled();
        button.simulate('click');

        expect(trackEvent).toHaveBeenCalledWith('ui', 'add_channels_cta_button_clicked');
    });

    test('should not display as a Cta Dropdown when user only has permissions to join channels ', () => {
        const userWithJoinChannelsPermission = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {
                    id: 'current_user_id',
                    roles: 'system_user_join_permissions',
                },
            },
        } as unknown as UsersState;
        mockState = {...mockState, entities: {...mockState.entities, users: userWithJoinChannelsPermission}};

        const wrapper = mountWithIntl(
            <AddChannelsCtaButton/>,
        );

        // do not find the menu
        expect(wrapper.find('.AddChannelsCtaDropdown').exists()).toBeFalsy();

        // only find the button
        const button = wrapper.find('button#addChannelsCta');
        expect(button.exists()).toBeTruthy();

        button.simulate('click');

        // when clicked show the browse channels modal
        expect(trackEvent).toHaveBeenCalledWith('ui', 'browse_channels_button_is_clicked');
    });

    test('should still display as a Cta Dropdown when user has permissions to create at least one form of channel', () => {
        const userWithJoinChannelsPermission = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {
                    id: 'current_user_id',
                    roles: 'system_user_create_public_permissions',
                },
            },
        } as unknown as UsersState;
        mockState = {...mockState, entities: {...mockState.entities, users: userWithJoinChannelsPermission}};

        const wrapper = mountWithIntl(
            <AddChannelsCtaButton/>,
        );

        expect(wrapper.find('.AddChannelsCtaDropdown').exists()).toBeTruthy();
    });
});
