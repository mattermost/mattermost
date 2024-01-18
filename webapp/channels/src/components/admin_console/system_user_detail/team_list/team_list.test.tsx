// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import TeamList from './team_list';

describe('admin_console/system_user_detail/team_list/TeamList', () => {
    const defaultProps = {
        userId: '1234',
        locale: 'en',
        emptyListTextId: 'emptyListTextId',
        emptyListTextDefaultMessage: 'No teams found',
        actions: {
            getTeamsData: jest.fn().mockResolvedValue({data: []}),
            getTeamMembersForUser: jest.fn().mockResolvedValue({data: []}),
            removeUserFromTeam: jest.fn(),
            updateTeamMemberSchemeRoles: jest.fn(),
        },
        userDetailCallback: jest.fn(),
        refreshTeams: false,
    };

    const teamsWithMemberships = [
        {
            id: 'id1',
            display_name: 'Team 1',
            description: 'Team 1 description',
        },
        {
            id: 'id2',
            display_name: 'Team 2',
            description: 'The 2 description',
        },
    ];

    test('should match snapshot when no teams are found', () => {
        const props = defaultProps;
        const wrapper = shallow(<TeamList {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with teams populated', () => {
        const props = defaultProps;
        const wrapper = shallow(
            <TeamList
                {...props}
            />,
        );
        wrapper.setState({teamsWithMemberships});
        expect(wrapper).toMatchSnapshot();
    });
});
