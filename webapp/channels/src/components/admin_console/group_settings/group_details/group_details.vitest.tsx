// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group, GroupChannel, GroupTeam} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import GroupDetails from 'components/admin_console/group_settings/group_details/group_details';

import {waitFor, renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/admin_console/group_settings/group_details/GroupDetails', () => {
    const defaultProps = {
        groupID: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
        group: {
            display_name: 'Group',
            name: 'Group',
        } as Group,
        groupTeams: [
            {team_id: '11111111111111111111111111'} as GroupTeam,
            {team_id: '22222222222222222222222222'} as GroupTeam,
            {team_id: '33333333333333333333333333'} as GroupTeam,
        ],
        groupChannels: [
            {channel_id: '44444444444444444444444444'} as GroupChannel,
            {channel_id: '55555555555555555555555555'} as GroupChannel,
            {channel_id: '66666666666666666666666666'} as GroupChannel,
        ],
        members: [
            {id: '77777777777777777777777777'} as UserProfile,
            {id: '88888888888888888888888888'} as UserProfile,
            {id: '99999999999999999999999999'} as UserProfile,
        ],
        memberCount: 20,
        actions: {
            getGroup: vi.fn().mockReturnValue(Promise.resolve()),
            getMembers: vi.fn().mockReturnValue(Promise.resolve()),
            getGroupStats: vi.fn().mockReturnValue(Promise.resolve()),
            getGroupSyncables: vi.fn().mockReturnValue(Promise.resolve()),
            link: vi.fn(),
            unlink: vi.fn(),
            patchGroup: vi.fn(),
            patchGroupSyncable: vi.fn(),
            setNavigationBlocked: vi.fn(),
        },
    };

    test('should match snapshot, with everything closed', () => {
        const {container} = renderWithContext(<GroupDetails {...defaultProps}/>);
        defaultProps.actions.getGroupSyncables.mockClear();
        expect(container).toMatchSnapshot();
    });

    test('should load data on mount', async () => {
        const actions = {
            getGroupSyncables: vi.fn().mockReturnValue(Promise.resolve()),
            getGroupStats: vi.fn().mockReturnValue(Promise.resolve()),
            getGroup: vi.fn().mockReturnValue(Promise.resolve()),
            getMembers: vi.fn().mockReturnValue(Promise.resolve()),
            link: vi.fn().mockReturnValue(Promise.resolve()),
            unlink: vi.fn().mockReturnValue(Promise.resolve()),
            patchGroup: vi.fn().mockReturnValue(Promise.resolve()),
            patchGroupSyncable: vi.fn().mockReturnValue(Promise.resolve()),
            setNavigationBlocked: vi.fn(),
        };
        renderWithContext(
            <GroupDetails
                {...defaultProps}
                actions={actions}
            />,
        );

        await waitFor(() => {
            expect(actions.getGroupSyncables).toHaveBeenCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx', 'team');
            expect(actions.getGroupSyncables).toHaveBeenCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx', 'channel');
            expect(actions.getGroupSyncables).toHaveBeenCalledTimes(2);
            expect(actions.getGroup).toHaveBeenCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx');
        });
    });
});
