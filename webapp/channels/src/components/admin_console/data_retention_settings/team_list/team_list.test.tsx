// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import TeamList from 'components/admin_console/data_retention_settings/team_list/team_list';
import {TestHelper} from 'utils/test_helper';
import {Team} from '@mattermost/types/teams';

describe('components/admin_console/data_retention_settings/team_list', () => {
    const team: Team = Object.assign(TestHelper.getTeamMock({id: 'team-1'}));

    test('should match snapshot', () => {
        const testTeams = [{
            ...team,
        }];
        const actions = {
            getDataRetentionCustomPolicyTeams: jest.fn().mockResolvedValue(testTeams),
            searchTeams: jest.fn(),
            setTeamListSearch: jest.fn(),
            setTeamListFilters: jest.fn(),
        };
        const wrapper = shallow(
            <TeamList
                searchTerm=''
                onRemoveCallback={jest.fn()}
                onAddCallback={jest.fn()}
                teamsToRemove={{}}
                teamsToAdd={{}}
                teams={testTeams}
                totalCount={testTeams.length}
                actions={actions}
            />);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with paging', () => {
        const testTeams = [];
        for (let i = 0; i < 30; i++) {
            testTeams.push({
                ...team,
                id: 'id' + i,
                display_name: 'DN' + i,
            });
        }

        const actions = {
            getDataRetentionCustomPolicyTeams: jest.fn().mockResolvedValue(testTeams),
            searchTeams: jest.fn(),
            setTeamListSearch: jest.fn(),
            setTeamListFilters: jest.fn(),
        };
        const wrapper = shallow(
            <TeamList
                searchTerm=''
                onRemoveCallback={jest.fn()}
                onAddCallback={jest.fn()}
                teamsToRemove={{}}
                teamsToAdd={{}}
                teams={testTeams}
                totalCount={testTeams.length}
                actions={actions}
            />);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });
});
