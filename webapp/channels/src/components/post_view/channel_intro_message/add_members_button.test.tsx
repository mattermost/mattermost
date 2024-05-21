// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {Permissions} from 'mattermost-redux/constants';
import * as teams from 'mattermost-redux/selectors/entities/teams';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AddMembersButton from './add_members_button';

describe('components/post_view/AddMembersButton', () => {
    const channel = {
        create_at: 1508265709607,
        creator_id: 'creator_id',
        delete_at: 0,
        display_name: 'test channel',
        header: 'test',
        id: 'channel_id',
        last_post_at: 1508265709635,
        name: 'testing',
        purpose: 'test',
        team_id: 'team-id',
        type: 'O',
        update_at: 1508265709607,
    } as Channel;

    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team-id',
            },
            users: {
                currentUserId: 'test-user-id',
                profiles: {
                    'test-user-id': {
                        id: 'test-user-id',
                        roles: 'system_role',
                    },
                },
            },
            roles: {
                roles: {
                    system_role: {permissions: [
                        Permissions.ADD_USER_TO_TEAM,
                        Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
                    ]},
                },
            },
        },
    };

    jest.spyOn(teams, 'getCurrentTeamId').mockReturnValue('team-id');

    test('should match snapshot, less than limit', () => {
        const props = {
            totalUsers: 10,
            usersLimit: 100,
            channel,
        };
        renderWithContext(
            <AddMembersButton {...props}/>,
            initialState,
        );

        expect(screen.queryByText('Invite others to the workspace')).toBeInTheDocument();
    });

    test('should match snapshot, more than limit', () => {
        const props = {
            totalUsers: 100,
            usersLimit: 10,
            channel,
        };
        renderWithContext(
            <AddMembersButton {...props}/>,
            initialState,
        );

        expect(screen.queryByText('Add people')).toBeInTheDocument();
    });

    test('should match snapshot, setHeader and pluginButtons', () => {
        const PLUGIN_TEXT = 'Create a board plugin';
        const pluginButtons = (
            <button>
                {PLUGIN_TEXT}
            </button>
        );

        const props = {
            totalUsers: 100,
            usersLimit: 10,
            channel,
            pluginButtons,
        };
        renderWithContext(
            <AddMembersButton {...props}/>,
            initialState,
        );

        expect(screen.queryByText(PLUGIN_TEXT)).toBeInTheDocument();
    });
});
