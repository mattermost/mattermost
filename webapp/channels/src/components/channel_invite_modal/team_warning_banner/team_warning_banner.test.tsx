// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import TeamWarningBanner from 'components/channel_invite_modal/team_warning_banner/team_warning_banner';
import type {Value} from 'components/multiselect/multiselect';

import {renderWithContext, screen} from 'tests/react_testing_utils';

type UserProfileValue = Value & UserProfile;

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        localizeMessage: jest.fn(),
        sortUsersAndGroups: jest.fn(),
    };
});

function createUsers(count: number): UserProfileValue[] {
    const users: UserProfileValue[] = [];
    for (let x = 0; x < count; x++) {
        const user = {
            id: 'user-' + x,
            username: 'user-' + x,
            label: 'user-' + x,
            value: 'user-' + x,
            delete_at: 0,
        } as UserProfileValue;
        users.push(user);
    }
    return users;
}

describe('components/channel_invite_modal/team_warning_banner', () => {
    const teamId = 'team1';
    const state = {
        entities: {
            channels: {},
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: {
                        id: 'team1',
                        display_name: 'Team Name Display',
                    },
                },
            },
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: 'admin1',
                profiles: {},
            },
            groups: {
                myGroups: [],
                groups: {},
            },
            emojis: {
                customEmoji: {},
            },
        },
    };

    test('should say board for a board', () => {
        renderWithContext(
            <TeamWarningBanner
                teamId={teamId}
                channelKind='board'
                users={createUsers(2)}
                guests={createUsers(2)}
            />,
            state,
        );

        expect(screen.getByText(/to this board once they are members of the/)).toBeInTheDocument();
        expect(screen.getByText(/before you can add them to the board\. Once they've joined the team, you can add them to this board\./)).toBeInTheDocument();
        expect(screen.queryByText(/this channel/)).not.toBeInTheDocument();
    });
});
