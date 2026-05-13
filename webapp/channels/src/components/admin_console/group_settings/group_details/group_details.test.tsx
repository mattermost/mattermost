// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';
import type {Group, GroupChannel, GroupTeam} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {GroupDetails} from 'components/admin_console/group_settings/group_details/group_details';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, act} from 'tests/react_testing_utils';

jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    getAllChannels: () => () => Promise.resolve({data: []}),
    searchAllChannels: () => () => Promise.resolve({data: []}),
}));

jest.mock('mattermost-redux/actions/teams', () => ({
    ...jest.requireActual('mattermost-redux/actions/teams'),
    getTeams: () => () => Promise.resolve({data: []}),
    searchTeams: () => () => Promise.resolve({data: []}),
}));

describe('components/admin_console/group_settings/group_details/GroupDetails', () => {
    const originalRAF = window.requestAnimationFrame;

    beforeEach(() => {
        window.requestAnimationFrame = jest.fn();
    });

    afterEach(() => {
        window.requestAnimationFrame = originalRAF;
    });

    const defaultProps = {
        intl: defaultIntl,
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
            {id: '77777777777777777777777777', username: 'user1', email: 'user1@test.com', last_picture_update: 0} as UserProfile,
            {id: '88888888888888888888888888', username: 'user2', email: 'user2@test.com', last_picture_update: 0} as UserProfile,
            {id: '99999999999999999999999999', username: 'user3', email: 'user3@test.com', last_picture_update: 0} as UserProfile,
        ],
        memberCount: 20,
        actions: {
            getGroup: jest.fn().mockReturnValue(Promise.resolve()),
            getMembers: jest.fn().mockReturnValue(Promise.resolve()),
            getGroupStats: jest.fn().mockReturnValue(Promise.resolve()),
            getGroupSyncables: jest.fn().mockReturnValue(Promise.resolve()),
            link: jest.fn(),
            unlink: jest.fn(),
            patchGroup: jest.fn(),
            patchGroupSyncable: jest.fn(),
            setNavigationBlocked: jest.fn(),
        },
    };

    test('should match snapshot, with everything closed', () => {
        const {container} = renderWithContext(<GroupDetails {...defaultProps}/>);
        defaultProps.actions.getGroupSyncables.mockClear();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with add team selector open', () => {
        const ref = React.createRef<InstanceType<typeof GroupDetails>>();
        const {container} = renderWithContext(
            <GroupDetails
                {...defaultProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({addTeamOpen: true});
        });
        defaultProps.actions.getGroupSyncables.mockClear();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with add channel selector open', () => {
        const ref = React.createRef<InstanceType<typeof GroupDetails>>();
        const {container} = renderWithContext(
            <GroupDetails
                {...defaultProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({addChannelOpen: true});
        });
        defaultProps.actions.getGroupSyncables.mockClear();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with loaded state', () => {
        const ref = React.createRef<InstanceType<typeof GroupDetails>>();
        const {container} = renderWithContext(
            <GroupDetails
                {...defaultProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({loadingTeamsAndChannels: false});
        });
        defaultProps.actions.getGroupSyncables.mockClear();
        expect(container).toMatchSnapshot();
    });

    test('should load data on mount', () => {
        const actions = {
            getGroupSyncables: jest.fn().mockReturnValue(Promise.resolve()),
            getGroupStats: jest.fn().mockReturnValue(Promise.resolve()),
            getGroup: jest.fn().mockReturnValue(Promise.resolve()),
            getMembers: jest.fn().mockReturnValue(Promise.resolve()),
            link: jest.fn(),
            unlink: jest.fn(),
            patchGroup: jest.fn(),
            patchGroupSyncable: jest.fn(),
            setNavigationBlocked: jest.fn(),
        };
        renderWithContext(
            <GroupDetails
                {...defaultProps}
                actions={actions}
            />,
        );
        expect(actions.getGroupSyncables).toHaveBeenCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx', 'team');
        expect(actions.getGroupSyncables).toHaveBeenCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx', 'channel');
        expect(actions.getGroupSyncables).toHaveBeenCalledTimes(2);
        expect(actions.getGroup).toHaveBeenCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx');
    });

    test('should set state for each channel when addChannels is called', async () => {
        const actions = {
            getGroupSyncables: jest.fn().mockReturnValue(Promise.resolve()),
            getGroupStats: jest.fn().mockReturnValue(Promise.resolve()),
            getGroup: jest.fn().mockReturnValue(Promise.resolve()),
            getMembers: jest.fn().mockReturnValue(Promise.resolve()),
            link: jest.fn().mockReturnValue(Promise.resolve()),
            unlink: jest.fn().mockReturnValue(Promise.resolve()),
            patchGroup: jest.fn(),
            patchGroupSyncable: jest.fn(),
            setNavigationBlocked: jest.fn(),
        };
        const ref = React.createRef<InstanceType<typeof GroupDetails>>();
        renderWithContext(
            <GroupDetails
                {...defaultProps}
                actions={actions}
                ref={ref}
            />,
        );
        await act(async () => {
            await (ref.current as any).addChannels([
                {id: '11111111111111111111111111', display_name: 'Channel 1', team_display_name: 'Team 1', team_id: 'team1', type: 'O'} as ChannelWithTeamData,
                {id: '22222222222222222222222222', display_name: 'Channel 2', team_display_name: 'Team 1', team_id: 'team1', type: 'O'} as ChannelWithTeamData,
            ]);
        });
        const testStateObj = (stateSubset?: GroupChannel[]) => {
            const channelIDs = stateSubset?.map((gc) => gc.channel_id);
            expect(channelIDs).toContain('11111111111111111111111111');
            expect(channelIDs).toContain('22222222222222222222222222');
        };
        testStateObj((ref.current as any).state.groupChannels);
        testStateObj((ref.current as any).state.channelsToAdd);
    });

    test('should set state for each team when addTeams is called', async () => {
        const actions = {
            getGroupSyncables: jest.fn().mockReturnValue(Promise.resolve()),
            getGroupStats: jest.fn().mockReturnValue(Promise.resolve()),
            getGroup: jest.fn().mockReturnValue(Promise.resolve()),
            getMembers: jest.fn().mockReturnValue(Promise.resolve()),
            link: jest.fn().mockReturnValue(Promise.resolve()),
            unlink: jest.fn().mockReturnValue(Promise.resolve()),
            patchGroup: jest.fn(),
            patchGroupSyncable: jest.fn(),
            setNavigationBlocked: jest.fn(),
        };
        const ref = React.createRef<InstanceType<typeof GroupDetails>>();
        renderWithContext(
            <GroupDetails
                {...defaultProps}
                actions={actions}
                ref={ref}
            />,
        );
        expect((ref.current as any).state.groupTeams?.length).toBe(0);
        act(() => {
            (ref.current as any).addTeams([
                {id: '11111111111111111111111111'} as Team,
                {id: '22222222222222222222222222'} as Team,
            ]);
        });
        const testStateObj = (stateSubset?: GroupTeam[]) => {
            const teamIDs = stateSubset?.map((gt) => gt.team_id);
            expect(teamIDs).toContain('11111111111111111111111111');
            expect(teamIDs).toContain('22222222222222222222222222');
        };
        testStateObj((ref.current as any).state.groupTeams);
        testStateObj((ref.current as any).state.teamsToAdd);
    });

    test('update name for null slug', async () => {
        const ref = React.createRef<InstanceType<typeof GroupDetails>>();
        renderWithContext(
            <GroupDetails
                {...defaultProps}
                group={{
                    display_name: 'test group',
                    allow_reference: false,
                } as Group}
                ref={ref}
            />,
        );

        act(() => {
            (ref.current as any).onMentionToggle(true);
        });
        expect((ref.current as any).state.groupMentionName).toBe('test-group');
    });

    test('update name for empty slug', async () => {
        const ref = React.createRef<InstanceType<typeof GroupDetails>>();
        renderWithContext(
            <GroupDetails
                {...defaultProps}
                group={{
                    name: '',
                    display_name: 'test group',
                    allow_reference: false,
                } as Group}
                ref={ref}
            />,
        );

        act(() => {
            (ref.current as any).onMentionToggle(true);
        });
        expect((ref.current as any).state.groupMentionName).toBe('test-group');
    });

    test('Should not update name for slug', async () => {
        const ref = React.createRef<InstanceType<typeof GroupDetails>>();
        renderWithContext(
            <GroupDetails
                {...defaultProps}
                group={{
                    name: 'any_name_at_all',
                    display_name: 'test group',
                    allow_reference: false,
                } as Group}
                ref={ref}
            />,
        );
        act(() => {
            (ref.current as any).onMentionToggle(true);
        });
        expect((ref.current as any).state.groupMentionName).toBe('any_name_at_all');
    });

    test('handleRolesToUpdate should only update scheme_admin and not auto_add', async () => {
        const patchGroupSyncable = jest.fn().mockReturnValue(Promise.resolve({data: true}));
        const actions = {
            ...defaultProps.actions,
            patchGroupSyncable,
        };

        const ref = React.createRef<InstanceType<typeof GroupDetails>>();
        renderWithContext(
            <GroupDetails
                {...defaultProps}
                actions={actions}
                ref={ref}
            />,
        );

        act(() => {
            ref.current!.setState({
                rolesToChange: {
                    'team1/public-team': true,
                    'channel1/public-channel': false,
                },
            } as any);
        });

        await act(async () => {
            await (ref.current as any).handleRolesToUpdate();
        });

        expect(patchGroupSyncable).toHaveBeenCalledTimes(2);
        expect(patchGroupSyncable).toHaveBeenCalledWith(
            'xxxxxxxxxxxxxxxxxxxxxxxxxx',
            'team1',
            'team',
            {scheme_admin: true},
        );
        expect(patchGroupSyncable).toHaveBeenCalledWith(
            'xxxxxxxxxxxxxxxxxxxxxxxxxx',
            'channel1',
            'channel',
            {scheme_admin: false},
        );

        // Verify auto_add was not included in any of the patch calls
        patchGroupSyncable.mock.calls.forEach((call) => {
            expect(call[3]).not.toHaveProperty('auto_add');
            expect(Object.keys(call[3]).length).toBe(1);
            expect(Object.keys(call[3])[0]).toBe('scheme_admin');
        });
    });
});
