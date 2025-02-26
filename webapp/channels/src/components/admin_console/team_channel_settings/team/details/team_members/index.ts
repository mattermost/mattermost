// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {UserProfile} from '@mattermost/types/users';

import {getTeamStats as loadTeamStats} from 'mattermost-redux/actions/teams';
import {getFilteredUsersStats} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getMembersInTeams, getTeamStats, getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getProfilesInTeam, searchProfilesInTeam, filterProfiles, getFilteredUsersStats as selectFilteredUsersStats} from 'mattermost-redux/selectors/entities/users';
import {filterProfilesStartingWithTerm, profileListToMap} from 'mattermost-redux/utils/user_utils';

import {loadProfilesAndReloadTeamMembers, searchProfilesAndTeamMembers} from 'actions/user_actions';
import {setUserGridSearch, setUserGridFilters} from 'actions/views/search';

import type {GlobalState} from 'types/store';

import TeamMembers from './team_members';

type Props = {
    teamId: string;
    usersToAdd: Record<string, UserProfile>;
    usersToRemove: Record<string, UserProfile>;
};

function searchUsersToAdd(users: Record<string, UserProfile>, term: string): Record<string, UserProfile> {
    const profiles = filterProfilesStartingWithTerm(Object.keys(users).map((key) => users[key]), term);
    const filteredProfilesMap = filterProfiles(profileListToMap(profiles), {});

    return filteredProfilesMap;
}

function mapStateToProps(state: GlobalState, props: Props) {
    const {teamId, usersToRemove} = props;
    let {usersToAdd} = props;

    const teamMembers = getMembersInTeams(state)[teamId] || {};
    const team = getTeam(state, teamId);
    const config = getConfig(state);
    const searchTerm = state.views.search.userGridSearch?.term || '';
    const filters = state.views.search.userGridSearch?.filters || {};

    let totalCount: number;
    if (Object.keys(filters).length === 0) {
        const stats = getTeamStats(state)[teamId] || {active_member_count: 0};
        totalCount = stats.active_member_count;
    } else {
        const filteredUserStats = selectFilteredUsersStats(state) || {
            total_users_count: 0,
        };
        totalCount = filteredUserStats.total_users_count ?? 0;
    }

    let users = [];
    if (searchTerm) {
        users = searchProfilesInTeam(state, teamId, searchTerm, false, {active: true, ...filters});
        usersToAdd = searchUsersToAdd(usersToAdd, searchTerm);
    } else {
        users = getProfilesInTeam(state, teamId, {active: true, ...filters});
    }

    return {
        filters,
        teamId,
        team,
        users,
        teamMembers,
        usersToAdd,
        usersToRemove,
        totalCount,
        searchTerm,
        enableGuestAccounts: config.EnableGuestAccounts === 'true',
    };
}
function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getTeamStats: loadTeamStats,
            loadProfilesAndReloadTeamMembers,
            searchProfilesAndTeamMembers,
            getFilteredUsersStats,
            setUserGridSearch,
            setUserGridFilters,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamMembers);
