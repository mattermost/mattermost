// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

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
        };

        const wrapper = shallow(
            <TeamList
                data={testTeams}
                total={testTeams.length}
                actions={actions}
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
        };

        const wrapper = shallow(
            <TeamList
                data={testTeams}
                total={30}
                actions={actions}
            />);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });
});
