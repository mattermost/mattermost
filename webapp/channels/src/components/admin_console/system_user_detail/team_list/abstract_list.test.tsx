// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AbstractList from './abstract_list';
import TeamRow from './team_row';
import type {TeamWithMembership} from './types';

describe('admin_console/system_user_detail/team_list/AbstractList', () => {
    const renderRow = jest.fn((item) => {
        return (
            <TeamRow
                key={item.id}
                team={item}
                onRowClick={jest.fn()}
                doRemoveUserFromTeam={jest.fn()}
                doMakeUserTeamAdmin={jest.fn()}
                doMakeUserTeamMember={jest.fn()}
            />
        );
    });

    const teamsWithMemberships = [
        {
            id: 'id1',
            display_name: 'Team 1',
            description: 'Team 1 description',
        } as TeamWithMembership,
        {
            id: 'id2',
            display_name: 'Team 2',
            description: 'The 2 description',
        } as TeamWithMembership,
    ];

    const headerLabels = [
        {
            label: {
                id: 'admin.team_settings.team_list.header.name',
                defaultMessage: 'Name',
            },
            style: {
                flexGrow: 1,
                minWidth: '284px',
                marginLeft: '16px',
            },
        },
        {
            label: {
                id: 'admin.systemUserDetail.teamList.header.type',
                defaultMessage: 'Type',
            },
            style: {
                width: '150px',
            },
        },
        {
            label: {
                id: 'admin.systemUserDetail.teamList.header.role',
                defaultMessage: 'Role',
            },
            style: {
                width: '150px',
            },
        },
    ];

    const defaultProps = {
        userId: '1234',
        data: [],
        onPageChangedCallback: jest.fn(),
        total: 0,
        headerLabels,
        renderRow,
        emptyList: {
            id: 'admin.team_settings.team_list.no_teams_found',
            defaultMessage: 'No teams found',
        },
        actions: {
            getTeamsData: jest.fn().mockResolvedValue(Promise.resolve([])),
            removeGroup: jest.fn(),
        },
    };

    test('should match snapshot if loading', () => {
        const props = defaultProps;
        const wrapper = shallow(<AbstractList {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot no data', () => {
        const props = defaultProps;
        const wrapper = shallow(<AbstractList {...props}/>);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with teams data populated', () => {
        const props = defaultProps;
        const wrapper = shallow(
            <AbstractList
                {...props}
                data={teamsWithMemberships}
                total={2}
            />,
        );
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with enough teams data to require paging', () => {
        const props = defaultProps;
        const moreTeams = teamsWithMemberships;
        for (let i = 3; i <= 30; i++) {
            moreTeams.push({
                id: 'id' + i,
                display_name: 'Team ' + i,
                description: 'Team ' + i + ' description',
            } as TeamWithMembership);
        }
        const wrapper = shallow(
            <AbstractList
                {...props}
                data={moreTeams}
                total={30}
            />,
        );
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when on second page of pagination', () => {
        const props = defaultProps;
        const moreTeams = teamsWithMemberships;
        for (let i = 3; i <= 30; i++) {
            moreTeams.push({
                id: 'id' + i,
                display_name: 'Team ' + i,
                description: 'Team ' + i + ' description',
            } as TeamWithMembership);
        }
        const wrapper = shallow(
            <AbstractList
                {...props}
                data={moreTeams}
                total={30}
            />,
        );
        wrapper.setState({
            loading: false,
            page: 1,
        });
        expect(wrapper).toMatchSnapshot();
    });
});
