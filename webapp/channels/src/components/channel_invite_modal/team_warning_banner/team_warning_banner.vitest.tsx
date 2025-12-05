// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import TeamWarningBanner from 'components/channel_invite_modal/team_warning_banner/team_warning_banner';
import type {Value} from 'components/multiselect/multiselect';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

type UserProfileValue = Value & UserProfile;

vi.mock('utils/utils', () => {
    const original = vi.importActual('utils/utils');
    return {
        ...original,
        localizeMessage: vi.fn(),
        sortUsersAndGroups: vi.fn(),
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

    test('should return empty snapshot', () => {
        const {container} = renderWithContext(
            <TeamWarningBanner
                teamId={teamId}
                users={[]}
                guests={[]}
            />,
            state,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for team_warning_banner with > 10 profiles', () => {
        const users = createUsers(11);

        const {container} = renderWithContext(
            <TeamWarningBanner
                teamId={teamId}
                users={users}
                guests={[]}
            />,
            state,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for team_warning_banner with < 10 profiles', () => {
        const users = createUsers(2);

        const {container} = renderWithContext(
            <TeamWarningBanner
                teamId={teamId}
                users={users}
                guests={[]}
            />,
            state,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for team_warning_banner with > 10 guest profiles', () => {
        const guests = createUsers(11);

        const {container} = renderWithContext(
            <TeamWarningBanner
                teamId={teamId}
                users={[]}
                guests={guests}
            />,
            state,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for team_warning_banner with < 10 guest profiles', () => {
        const guests = createUsers(2);

        const {container} = renderWithContext(
            <TeamWarningBanner
                teamId={teamId}
                users={[]}
                guests={guests}
            />,
            state,
        );
        expect(container).toMatchSnapshot();
    });
});
