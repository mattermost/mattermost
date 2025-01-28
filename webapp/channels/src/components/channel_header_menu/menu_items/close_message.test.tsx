// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import * as preferences from 'mattermost-redux/actions/preferences';

import * as channelActions from 'actions/views/channel';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {Constants} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import CloseMessage from './close_message';

describe('components/ChannelHeaderMenu/MenuItems/CloseMessage', () => {
    const initialState = {
        entities: {
            channels: {
                currentChannelId: 'current_channel_id',
                channels: {
                    current_channel_id: TestHelper.getChannelMock({
                        id: 'current_channel_id',
                        name: 'default-name',
                        display_name: 'Default',
                        delete_at: 0,
                        type: 'O',
                        team_id: 'team_id',
                    }),
                },
            },
            teams: {
                currentTeamId: 'team-id',
                teams: {
                    'team-id': {
                        id: 'team_id',
                        name: 'team-1',
                        display_name: 'Team 1',
                    },
                },
                myMembers: {
                    'team-id': {roles: 'team_role'},
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        locale: 'en',
                        roles: 'system_role',
                    },
                },
            },
        },
    };

    const groupChannel = TestHelper.getChannelMock({
        id: 'channel_id',
        name: 'groupChannel',
        type: Constants.GM_CHANNEL as ChannelType,
    });

    const directChannel = TestHelper.getChannelMock({
        id: 'channel_id',
        type: Constants.DM_CHANNEL as ChannelType,
        teammate_id: 'teammate-id',
        name: 'directChannel',
    });

    beforeEach(() => {
        jest.spyOn(channelActions, 'leaveDirectChannel');
        jest.spyOn(preferences, 'savePreferences');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders the component correctly for group channel', () => {
        renderWithContext(
            <WithTestMenuContext>
                <CloseMessage
                    currentUserID='current_user_id'
                    channel={groupChannel}
                />
            </WithTestMenuContext>, initialState,
        );

        const menuItem = screen.getByText('Close Group Message');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(channelActions.leaveDirectChannel).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(channelActions.leaveDirectChannel).toHaveBeenCalledWith(groupChannel.name);

        expect(preferences.savePreferences).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(preferences.savePreferences).toHaveBeenCalledWith(
            'current_user_id',
            [{user_id: 'current_user_id', category: Constants.Preferences.CATEGORY_GROUP_CHANNEL_SHOW, name: groupChannel.id, value: 'false'}],
        );
    });

    test('renders the component correctly for direct channel', () => {
        renderWithContext(
            <WithTestMenuContext>
                <CloseMessage
                    currentUserID='current_user_id'
                    channel={directChannel}
                />
            </WithTestMenuContext>, initialState,
        );

        const menuItem = screen.getByText('Close Direct Message');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(channelActions.leaveDirectChannel).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(channelActions.leaveDirectChannel).toHaveBeenCalledWith(directChannel.name);

        expect(preferences.savePreferences).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(preferences.savePreferences).toHaveBeenCalledWith(
            'current_user_id',
            [{user_id: 'current_user_id', category: Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, name: directChannel.teammate_id, value: 'false'}],
        );
    });
});
