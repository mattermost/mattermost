// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';
import type {Group, GroupChannel, GroupTeam} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import GroupDetails from 'components/admin_console/group_settings/group_details/group_details';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

function getAnyInstance(wrapper: any) {
    return wrapper.instance() as any;
}

function getAnyState(wrapper: any) {
    return wrapper.state() as any;
}

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
        const wrapper = shallowWithIntl(<GroupDetails {...defaultProps}/>);
        defaultProps.actions.getGroupSyncables.mockClear();
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with add team selector open', () => {
        const wrapper = shallowWithIntl(<GroupDetails {...defaultProps}/>);
        wrapper.setState({addTeamOpen: true});
        defaultProps.actions.getGroupSyncables.mockClear();
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with add channel selector open', () => {
        const wrapper = shallowWithIntl(<GroupDetails {...defaultProps}/>);
        wrapper.setState({addChannelOpen: true});
        defaultProps.actions.getGroupSyncables.mockClear();
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with loaded state', () => {
        const wrapper = shallowWithIntl(<GroupDetails {...defaultProps}/>);
        wrapper.setState({loading: false, loadingTeamsAndChannels: false});
        defaultProps.actions.getGroupSyncables.mockClear();
        expect(wrapper).toMatchSnapshot();
    });

    test('should load data on mount', () => {
        const actions = {
            getGroupSyncables: jest.fn().mockReturnValue(Promise.resolve()),
            getGroupStats: jest.fn().mockReturnValue(Promise.resolve()),
            getGroup: jest.fn().mockReturnValue(Promise.resolve()),
            getMembers: jest.fn(),
            link: jest.fn(),
            unlink: jest.fn(),
            patchGroup: jest.fn(),
            patchGroupSyncable: jest.fn(),
            setNavigationBlocked: jest.fn(),
        };
        shallowWithIntl(
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
            getMembers: jest.fn(),
            link: jest.fn().mockReturnValue(Promise.resolve()),
            unlink: jest.fn().mockReturnValue(Promise.resolve()),
            patchGroup: jest.fn(),
            patchGroupSyncable: jest.fn(),
            setNavigationBlocked: jest.fn(),
        };
        const wrapper = shallowWithIntl(
            <GroupDetails
                {...defaultProps}
                actions={actions}
            />,
        );
        const instance = getAnyInstance(wrapper);
        await instance.addChannels([
            {id: '11111111111111111111111111'} as ChannelWithTeamData,
            {id: '22222222222222222222222222'} as ChannelWithTeamData,
        ]);
        const testStateObj = (stateSubset?: GroupChannel[]) => {
            const channelIDs = stateSubset?.map((gc) => gc.channel_id);
            expect(channelIDs).toContain('11111111111111111111111111');
            expect(channelIDs).toContain('22222222222222222222222222');
        };
        testStateObj(instance.state.groupChannels);
        testStateObj(instance.state.channelsToAdd);
    });

    test('should set state for each team when addTeams is called', async () => {
        const actions = {
            getGroupSyncables: jest.fn().mockReturnValue(Promise.resolve()),
            getGroupStats: jest.fn().mockReturnValue(Promise.resolve()),
            getGroup: jest.fn().mockReturnValue(Promise.resolve()),
            getMembers: jest.fn(),
            link: jest.fn().mockReturnValue(Promise.resolve()),
            unlink: jest.fn().mockReturnValue(Promise.resolve()),
            patchGroup: jest.fn(),
            patchGroupSyncable: jest.fn(),
            setNavigationBlocked: jest.fn(),
        };
        const wrapper = shallowWithIntl(
            <GroupDetails
                {...defaultProps}
                actions={actions}
            />,
        );
        const instance = getAnyInstance(wrapper);
        expect(instance.state.groupTeams?.length === 0);
        instance.addTeams([
            {id: '11111111111111111111111111'} as Team,
            {id: '22222222222222222222222222'} as Team,
        ]);
        const testStateObj = (stateSubset?: GroupTeam[]) => {
            const teamIDs = stateSubset?.map((gt) => gt.team_id);
            expect(teamIDs).toContain('11111111111111111111111111');
            expect(teamIDs).toContain('22222222222222222222222222');
        };
        testStateObj(instance.state.groupTeams);
        testStateObj(instance.state.teamsToAdd);
    });

    test('update name for null slug', async () => {
        const wrapper = shallowWithIntl(
            <GroupDetails
                {...defaultProps}
                group={{
                    display_name: 'test group',
                    allow_reference: false,
                } as Group}
            />,
        );

        getAnyInstance(wrapper).onMentionToggle(true);
        expect(getAnyState(wrapper).groupMentionName).toBe('test-group');
    });

    test('update name for empty slug', async () => {
        const wrapper = shallowWithIntl(
            <GroupDetails
                {...defaultProps}
                group={{
                    name: '',
                    display_name: 'test group',
                    allow_reference: false,
                } as Group}
            />,
        );

        getAnyInstance(wrapper).onMentionToggle(true);
        expect(getAnyState(wrapper).groupMentionName).toBe('test-group');
    });

    test('Should not update name for slug', async () => {
        const wrapper = shallowWithIntl(
            <GroupDetails
                {...defaultProps}
                group={{
                    name: 'any_name_at_all',
                    display_name: 'test group',
                    allow_reference: false,
                } as Group}
            />,
        );
        getAnyInstance(wrapper).onMentionToggle(true);
        expect(getAnyState(wrapper).groupMentionName).toBe('any_name_at_all');
    });

    test('handleRolesToUpdate should only update scheme_admin and not auto_add', async () => {
        const patchGroupSyncable = jest.fn().mockReturnValue(Promise.resolve({data: true}));
        const actions = {
            ...defaultProps.actions,
            patchGroupSyncable,
        };

        const wrapper = shallowWithIntl(
            <GroupDetails
                {...defaultProps}
                actions={actions}
            />,
        );

        const instance = getAnyInstance(wrapper);
        instance.setState({
            rolesToChange: {
                'team1/public-team': true,
                'channel1/public-channel': false,
            },
        });

        await instance.handleRolesToUpdate();

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
