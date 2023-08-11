// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import type {Team} from '@mattermost/types/teams';

import SelectTeamItem from './select_team_item';

describe('components/select_team/components/SelectTeamItem', () => {
    const baseProps = {
        team: {display_name: 'team_display_name', allow_open_invite: true} as Team,
        onTeamClick: jest.fn(),
        loading: false,
        canJoinPublicTeams: true,
        canJoinPrivateTeams: false,
    };

    test('should match snapshot, on public joinable', () => {
        const wrapper = shallow<SelectTeamItem>(<SelectTeamItem {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on public not joinable', () => {
        const props = {...baseProps, canJoinPublicTeams: false};
        const wrapper = shallow<SelectTeamItem>(
            <SelectTeamItem {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on private joinable', () => {
        const props = {...baseProps, team: {...baseProps.team, allow_open_invite: false}, canJoinPrivateTeams: true};
        const wrapper = shallow<SelectTeamItem>(
            <SelectTeamItem {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on private not joinable', () => {
        const props = {...baseProps, team: {...baseProps.team, allow_open_invite: false}};
        const wrapper = shallow<SelectTeamItem>(
            <SelectTeamItem {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on loading', () => {
        const props = {...baseProps, loading: true};
        const wrapper = shallow<SelectTeamItem>(
            <SelectTeamItem {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with description', () => {
        const props = {...baseProps, team: {...baseProps.team, description: 'description'}};
        const wrapper = shallow<SelectTeamItem>(
            <SelectTeamItem {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should call props.onTeamClick on handleTeamClick', () => {
        const wrapper = shallow<SelectTeamItem>(
            <SelectTeamItem {...baseProps}/>,
        );
        wrapper.instance().handleTeamClick({preventDefault: jest.fn()} as any);
        expect(baseProps.onTeamClick).toHaveBeenCalledTimes(1);
        expect(baseProps.onTeamClick).toHaveBeenCalledWith(baseProps.team);
    });

    test('should not call props.onTeamClick on handleTeamClick when you cant join the team', () => {
        const props = {...baseProps, canJoinPublicTeams: false};
        const wrapper = shallow<SelectTeamItem>(
            <SelectTeamItem {...props}/>,
        );
        wrapper.instance().handleTeamClick({preventDefault: jest.fn()} as any);
        expect(baseProps.onTeamClick).toHaveBeenCalledTimes(1);
        expect(baseProps.onTeamClick).toHaveBeenCalledWith(baseProps.team);
    });
});
