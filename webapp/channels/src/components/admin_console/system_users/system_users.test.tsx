// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import SystemUsers from 'components/admin_console/system_users/system_users';

import {Constants, SearchUserTeamFilter, UserFilters} from 'utils/constants';

jest.mock('actions/admin_actions');

jest.useFakeTimers();

describe('components/admin_console/system_users', () => {
    const USERS_PER_PAGE = 50;
    const defaultProps = {
        teams: [],
        siteName: 'Site name',
        mfaEnabled: false,
        enableUserAccessTokens: false,
        experimentalEnableAuthenticationTransfer: false,
        searchTerm: '',
        teamId: '',
        filter: '',
        totalUsers: 0,
        users: {},
        actions: {
            getTeams: jest.fn().mockResolvedValue({data: []}),
            getTeamStats: jest.fn().mockResolvedValue({data: []}),
            getUser: jest.fn().mockResolvedValue({data: {}}),
            getUserAccessToken: jest.fn().mockResolvedValue({data: ''}),
            loadProfilesAndTeamMembers: jest.fn().mockResolvedValue({data: true}),
            setSystemUsersSearch: jest.fn().mockResolvedValue({data: true}),
            loadProfilesWithoutTeam: jest.fn().mockResolvedValue({data: true}),
            getProfiles: jest.fn().mockResolvedValue({data: []}),
            searchProfiles: jest.fn().mockResolvedValue({data: []}),
            revokeSessionsForAllUsers: jest.fn().mockResolvedValue({data: true}),
            logError: jest.fn(),
            getFilteredUsersStats: jest.fn(),
        },
    };

    test('should match default snapshot', () => {
        const props = defaultProps;
        const wrapper = shallow<SystemUsers>(<SystemUsers {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('loadDataForTeam() should have called getProfiles', async () => {
        const getProfiles = jest.fn().mockResolvedValue(undefined);
        const props = {...defaultProps, actions: {...defaultProps.actions, getProfiles}};
        const wrapper = shallow<SystemUsers>(<SystemUsers {...props}/>);

        wrapper.setState({loading: true});

        await wrapper.instance().loadDataForTeam(SearchUserTeamFilter.ALL_USERS, '');

        expect(getProfiles).toHaveBeenCalled();
        expect(getProfiles).toHaveBeenCalledWith(0, Constants.PROFILE_CHUNK_SIZE, {});
        expect(wrapper.state().loading).toEqual(false);
    });

    test('loadDataForTeam() should have called loadProfilesWithoutTeam', async () => {
        const loadProfilesWithoutTeam = jest.fn().mockResolvedValue(undefined);
        const props = {...defaultProps, actions: {...defaultProps.actions, loadProfilesWithoutTeam}};
        const wrapper = shallow<SystemUsers>(<SystemUsers {...props}/>);

        wrapper.setState({loading: true});

        await wrapper.instance().loadDataForTeam(SearchUserTeamFilter.NO_TEAM, '');

        expect(loadProfilesWithoutTeam).toHaveBeenCalled();
        expect(loadProfilesWithoutTeam).toHaveBeenCalledWith(0, Constants.PROFILE_CHUNK_SIZE, {});
        expect(wrapper.state().loading).toEqual(false);

        await wrapper.instance().loadDataForTeam(SearchUserTeamFilter.NO_TEAM, UserFilters.INACTIVE);

        expect(loadProfilesWithoutTeam).toHaveBeenCalled();
        expect(loadProfilesWithoutTeam).toHaveBeenCalledWith(0, Constants.PROFILE_CHUNK_SIZE, {inactive: true});
    });

    test('nextPage() should have called getProfiles', async () => {
        const getProfiles = jest.fn().mockResolvedValue(undefined);
        const props = {
            ...defaultProps,
            teamId: SearchUserTeamFilter.ALL_USERS,
            actions: {...defaultProps.actions, getProfiles},
        };
        const wrapper = shallow<SystemUsers>(<SystemUsers {...props}/>);

        wrapper.setState({loading: true});

        await wrapper.instance().nextPage(0);

        expect(getProfiles).toHaveBeenCalled();
        expect(getProfiles).toHaveBeenCalledWith(1, USERS_PER_PAGE, {});
        expect(wrapper.state().loading).toEqual(false);
    });

    test('nextPage() should have called loadProfilesWithoutTeam', async () => {
        const loadProfilesWithoutTeam = jest.fn().mockResolvedValue({data: true});
        const props = {
            ...defaultProps,
            teamId: SearchUserTeamFilter.NO_TEAM,
            actions: {...defaultProps.actions, loadProfilesWithoutTeam},
        };
        const wrapper = shallow<SystemUsers>(<SystemUsers {...props}/>);

        wrapper.setState({loading: true});

        await wrapper.instance().nextPage(0);

        expect(loadProfilesWithoutTeam).toHaveBeenCalled();
        expect(loadProfilesWithoutTeam).toHaveBeenCalledWith(1, USERS_PER_PAGE, {});
        expect(wrapper.state().loading).toEqual(false);
    });

    test('doSearch() should have called searchProfiles with allow_inactive', async () => {
        const searchProfiles = jest.fn().mockResolvedValue({data: [{}]});
        const props = {
            ...defaultProps,
            teamId: SearchUserTeamFilter.NO_TEAM,
            actions: {...defaultProps.actions, searchProfiles},
        };
        const wrapper = shallow<SystemUsers>(<SystemUsers {...props}/>);

        await wrapper.instance().doSearch('searchterm', '', '');

        jest.runOnlyPendingTimers();
        expect(searchProfiles).toHaveBeenCalled();
        expect(searchProfiles).toHaveBeenCalledWith('searchterm', {allow_inactive: true});
    });

    test('doSearch() should have called searchProfiles with allow_inactive and system_admin role', async () => {
        const searchProfiles = jest.fn().mockResolvedValue({data: [{}]});
        const props = {
            ...defaultProps,
            teamId: SearchUserTeamFilter.NO_TEAM,
            actions: {...defaultProps.actions, searchProfiles},
        };
        const wrapper = shallow<SystemUsers>(<SystemUsers {...props}/>);

        await wrapper.instance().doSearch('searchterm', '', 'system_admin');

        jest.runOnlyPendingTimers();
        expect(searchProfiles).toHaveBeenCalled();
        expect(searchProfiles).toHaveBeenCalledWith('searchterm', {allow_inactive: true, role: 'system_admin'});
    });
});
