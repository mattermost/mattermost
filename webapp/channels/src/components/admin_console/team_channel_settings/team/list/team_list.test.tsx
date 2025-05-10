// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {adminConsoleTeamManagementTablePropertiesInitialState} from 'reducers/views/admin';

import {TestHelper} from 'utils/test_helper';

import type {AdminConsoleTeamManagementTableProperties} from 'types/store/views';

import TeamList from './team_list';

describe('admin_console/team_channel_settings/team/TeamList', () => {
    test('should match snapshot', () => {
        const testTeams = [TestHelper.getTeamMock({
            id: '123',
            display_name: 'DN',
            name: 'DN',
        })];

        const actions = {
            getData: jest.fn().mockResolvedValue(testTeams),
            searchTeams: jest.fn().mockResolvedValue(testTeams),
            setAdminConsoleTeamsManagementTableProperties: jest.fn(),
        };

        const tableProperties = adminConsoleTeamManagementTablePropertiesInitialState;

        const wrapper = shallow(
            <TeamList
                data={testTeams}
                total={testTeams.length}
                actions={actions}
                tableProperties={tableProperties}
            />);

        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with paging', () => {
        const testTeams = [];
        for (let i = 0; i < 30; i++) {
            testTeams.push(TestHelper.getTeamMock({
                id: 'id' + i,
                display_name: 'DN' + i,
                name: 'DN' + i,
            }));
        }
        const actions = {
            getData: jest.fn().mockResolvedValue(Promise.resolve(testTeams)),
            searchTeams: jest.fn().mockResolvedValue(testTeams),
            setAdminConsoleTeamsManagementTableProperties: jest.fn(),
        };

        const tableProperties = adminConsoleTeamManagementTablePropertiesInitialState;

        const wrapper = shallow(
            <TeamList
                data={testTeams}
                total={30}
                actions={actions}
                tableProperties={tableProperties}
            />);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should call setAdminConsoleTeamsManagementTableProperties and set state', () => {
        const testTeams = [TestHelper.getTeamMock({
            id: '123',
            display_name: 'DN',
            name: 'DN',
        })];

        const searchOpts = {
            allow_open_invite: true,
            group_constrained: true,
            invite_only: true,
        };
        const tableProperties: AdminConsoleTeamManagementTableProperties = {
            pageIndex: 0,
            searchTerm: 'test',
            searchOpts,
        };

        const setGlobalState = jest.fn();
        const actions = {
            getData: jest.fn().mockResolvedValue(Promise.resolve(testTeams)),
            searchTeams: jest.fn().mockResolvedValue(testTeams),
            setAdminConsoleTeamsManagementTableProperties: setGlobalState,
        };

        const wrapper = shallow<TeamList>(
            <TeamList
                data={testTeams}
                total={testTeams.length}
                actions={actions}
                tableProperties={tableProperties}
            />);
        wrapper.setState({loading: false});
        expect(wrapper.find('DataGrid').find('rows')).toEqual({});
        expect(wrapper).toMatchSnapshot();
        expect(setGlobalState).toBeCalledWith(tableProperties);
        expect(wrapper.instance().state.searchOpts).toEqual(searchOpts);
    });
});
