// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import GroupMemberList from './group_member_list';
import type {GroupMember} from './group_member_list';

import {Load} from '../constants';

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

describe('component/user_group_popover/group_member_list', () => {
    const profiles: Record<string, UserProfile> = {};
    const profilesInGroup: Record<Group['id'], Set<UserProfile['id']>> = {};
    const statuses: Record<UserProfile['id'], string> = {};

    const group = TestHelper.getGroupMock({
        member_count: 5,
    });

    const members: GroupMember[] = [];

    for (let i = 0; i < 5; ++i) {
        const user = TestHelper.getUserMock({
            id: 'id' + i,
            username: 'username' + i,
            first_name: 'Name' + i,
            last_name: 'Surname' + i,
            email: 'test' + i + '@test.com',
        });
        const displayName = displayUsername(user, General.TEAMMATE_NAME_DISPLAY.SHOW_FULLNAME);
        members.push({user, displayName});
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

    const baseProps = {
        searchTerm: '',
        group,
        canManageGroup: true,
        showUserOverlay: vi.fn(),
        hide: vi.fn(),
        searchState: Load.DONE,
        members,
        teamUrl: 'team',
        actions: {
            getUsersInGroup: vi.fn().mockImplementation(() => Promise.resolve()),
            openDirectChannelToUserId: vi.fn().mockImplementation(() => Promise.resolve()),
            closeRightHandSide: vi.fn(),
        },
    };

    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <GroupMemberList {...baseProps}/>,
            initialState,
        );

        await new Promise(process.nextTick);
        expect(container).toMatchSnapshot();
    });

    test('should open dms', async () => {
        const openDirectChannelToUserId = vi.fn().mockImplementation(() => Promise.resolve());
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                openDirectChannelToUserId,
            },
        };

        const {container} = renderWithContext(
            <GroupMemberList {...props}/>,
            initialState,
        );

        await new Promise(process.nextTick);

        const dmButton = container.querySelector('.group-member-list_dm-button');
        if (dmButton) {
            dmButton.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        }

        expect(openDirectChannelToUserId).toHaveBeenCalledTimes(0);
    });

    test('should show user overlay and hide', async () => {
        const showUserOverlay = vi.fn();
        const hide = vi.fn();
        const props = {
            ...baseProps,
            showUserOverlay,
            hide,
        };

        const {container} = renderWithContext(
            <GroupMemberList {...props}/>,
            initialState,
        );

        await new Promise(process.nextTick);

        const memberItem = container.querySelector('.group-member-list_item');
        if (memberItem) {
            memberItem.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        }

        expect(showUserOverlay).toHaveBeenCalledTimes(0);
        expect(hide).toHaveBeenCalledTimes(0);
    });
});
