// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import GroupTeamsAndChannels from 'components/admin_console/group_settings/group_details/group_teams_and_channels';

describe('components/admin_console/group_settings/group_details/GroupTeamsAndChannels', () => {
    const defaultProps = {
        id: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
        teams: [
            {
                team_id: '11111111111111111111111111',
                team_type: 'O',
                team_display_name: 'Team 1',
            },
            {
                team_id: '22222222222222222222222222',
                team_type: 'P',
                team_display_name: 'Team 2',
            },
            {
                team_id: '33333333333333333333333333',
                team_type: 'P',
                team_display_name: 'Team 3',
            },
        ],
        channels: [
            {
                team_id: '11111111111111111111111111',
                team_type: 'O',
                team_display_name: 'Team 1',
                channel_id: '44444444444444444444444444',
                channel_type: 'O',
                channel_display_name: 'Channel 4',
            },
            {
                team_id: '99999999999999999999999999',
                team_type: 'O',
                team_display_name: 'Team 9',
                channel_id: '55555555555555555555555555',
                channel_type: 'P',
                channel_display_name: 'Channel 5',
            },
            {
                team_id: '99999999999999999999999999',
                team_type: 'O',
                team_display_name: 'Team 9',
                channel_id: '55555555555555555555555555',
                channel_type: 'P',
                channel_display_name: 'Channel 5',
            },
        ],
        loading: false,
        getGroupSyncables: jest.fn().mockReturnValue(Promise.resolve()),
        unlink: jest.fn(),
        onChangeRoles: jest.fn(),
        onRemoveItem: jest.fn(),
    };

    test('should match snapshot, with teams, with channels and loading', () => {
        const wrapper = shallow(
            <GroupTeamsAndChannels
                {...defaultProps}
                loading={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with teams, with channels and loaded', () => {
        const wrapper = shallow(
            <GroupTeamsAndChannels
                {...defaultProps}
                loading={false}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, without teams, without channels and loading', () => {
        const wrapper = shallow(
            <GroupTeamsAndChannels
                {...defaultProps}
                teams={[]}
                channels={[]}
                loading={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, without teams, without channels and loaded', () => {
        const wrapper = shallow(
            <GroupTeamsAndChannels
                {...defaultProps}
                teams={[]}
                channels={[]}
                loading={false}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should toggle the collapse for an element', () => {
        const wrapper = shallow<GroupTeamsAndChannels>(<GroupTeamsAndChannels {...defaultProps}/>);
        const instance = wrapper.instance();
        expect(
            Boolean(wrapper.state().collapsed['11111111111111111111111111']),
        ).toBe(false);
        expect(
            Boolean(wrapper.state().collapsed['22222222222222222222222222']),
        ).toBe(false);
        instance.onToggleCollapse('11111111111111111111111111');
        expect(
            Boolean(wrapper.state().collapsed['11111111111111111111111111']),
        ).toBe(true);
        expect(
            Boolean(wrapper.state().collapsed['22222222222222222222222222']),
        ).toBe(false);
        instance.onToggleCollapse('11111111111111111111111111');
        expect(
            Boolean(wrapper.state().collapsed['11111111111111111111111111']),
        ).toBe(false);
        expect(
            Boolean(wrapper.state().collapsed['22222222222222222222222222']),
        ).toBe(false);
    });

    test('should invoke the onRemoveItem callback', async () => {
        const onRemoveItem = jest.fn();
        const wrapper = shallow<GroupTeamsAndChannels>(
            <GroupTeamsAndChannels
                {...defaultProps}
                onChangeRoles={jest.fn()}
                onRemoveItem={onRemoveItem}
            />,
        );
        const instance = wrapper.instance();
        instance.onRemoveItem('11111111111111111111111111', 'public-team');
        expect(onRemoveItem).toBeCalledWith(
            '11111111111111111111111111',
            'public-team',
        );
    });

    test('should invoke the onChangeRoles callback', async () => {
        const onChangeRoles = jest.fn();
        const wrapper = shallow<GroupTeamsAndChannels>(
            <GroupTeamsAndChannels
                {...defaultProps}
                onChangeRoles={onChangeRoles}
                onRemoveItem={jest.fn()}
            />,
        );
        const instance = wrapper.instance();
        instance.onChangeRoles(
            '11111111111111111111111111',
            'public-team',
            true,
        );
        expect(onChangeRoles).toBeCalledWith(
            '11111111111111111111111111',
            'public-team',
            true,
        );
    });
});
