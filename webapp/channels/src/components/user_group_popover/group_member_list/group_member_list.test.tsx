// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import GroupMemberList from './group_member_list';
import type {GroupMember} from './group_member_list';

import {Load} from '../constants';

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
        showUserOverlay: jest.fn(),
        hide: jest.fn(),
        searchState: Load.DONE,
        members,
        teamUrl: 'team',
        actions: {
            getUsersInGroup: jest.fn().mockImplementation(() => Promise.resolve()),
            openDirectChannelToUserId: jest.fn().mockImplementation(() => Promise.resolve()),
            closeRightHandSide: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <GroupMemberList
                {...baseProps}
            />,
            initialState as any,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should open dms', async () => {
        const {container} = renderWithContext(
            <GroupMemberList
                {...baseProps}
            />,
            initialState as any,
        );

        const dmButton = container.querySelector('.group-member-list_dm-button');
        if (dmButton) {
            await userEvent.click(dmButton);
        }
        expect(baseProps.actions.openDirectChannelToUserId).toHaveBeenCalledTimes(0);
    });

    test('should show user overlay and hide', async () => {
        const {container} = renderWithContext(
            <GroupMemberList
                {...baseProps}
            />,
            initialState as any,
        );

        const listItem = container.querySelector('.group-member-list_item');
        if (listItem) {
            await userEvent.click(listItem);
        }
        expect(baseProps.showUserOverlay).toHaveBeenCalledTimes(0);
        expect(baseProps.hide).toHaveBeenCalledTimes(0);
    });
});
