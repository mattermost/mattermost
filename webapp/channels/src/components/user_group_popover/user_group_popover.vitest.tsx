// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserGroupPopover from './user_group_popover';

vi.mock('react-redux', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as object,
        useDispatch: vi.fn().mockReturnValue(() => {}),
    };
});

vi.mock('react-virtualized-auto-sizer', () => ({
    default: ({children}: {children: any}) => children({height: 100, width: 100}),
}));

describe('component/user_group_popover', () => {
    const profiles: Record<string, UserProfile> = {};
    const profilesInGroup: Record<Group['id'], Set<UserProfile['id']>> = {};
    const statuses: Record<UserProfile['id'], string> = {};

    const group1 = TestHelper.getGroupMock({
        id: 'group1',
        member_count: 15,
    });

    const group2 = TestHelper.getGroupMock({
        id: 'group2',
        member_count: 5,
    });

    profilesInGroup[group1.id] = new Set();
    profilesInGroup[group2.id] = new Set();

    for (let i = 0; i < 15; ++i) {
        const user = TestHelper.getUserMock({
            id: 'id' + i,
            username: 'username' + i,
            first_name: 'Name' + i,
            last_name: 'Surname' + i,
            email: 'test' + i + '@test.com',
        });
        profiles[user.id] = user;
        profilesInGroup[group1.id].add(user.id);
        if (i < 5) {
            profilesInGroup[group2.id].add(user.id);
        }
    }

    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team_id1',
                teams: {
                    team_id1: {
                        id: 'team_id1',
                        name: 'team1',
                    },
                },
            },
            general: {
                config: {},
            },
            users: {
                profiles,
                profilesInGroup,
                statuses,
            },
            preferences: {
                myPreferences: {},
            },
        },
        views: {
            modals: {
                modalState: {},
            },
            search: {
                popoverSearch: '',
            },
        },
    };

    const baseProps: ComponentProps<typeof UserGroupPopover> = {
        group: group1,
        hide: vi.fn(),
        returnFocus: vi.fn(),
    };

    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <UserGroupPopover {...baseProps}/>,
            initialState,
        );

        await new Promise(process.nextTick);
        expect(container).toMatchSnapshot();
    });

    test('should not show search bar', async () => {
        const {container} = renderWithContext(
            <UserGroupPopover
                {...baseProps}
                group={group2}
            />,
            initialState,
        );

        await new Promise(process.nextTick);
        expect(container.querySelector('.user-group-popover_search-bar')).not.toBeInTheDocument();
    });

    test('should show users', async () => {
        const {container} = renderWithContext(
            <UserGroupPopover {...baseProps}/>,
            initialState,
        );

        await new Promise(process.nextTick);

        // Check that user list items are displayed
        expect(container.querySelectorAll('.group-member-list_item').length).toBeGreaterThan(0);
    });
});
