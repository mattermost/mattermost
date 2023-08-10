// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {logError} from 'mattermost-redux/actions/errors';
import {getTeams, getTeamStats} from 'mattermost-redux/actions/teams';
import {
    getUser,
    getUserAccessToken,
    getProfiles,
    searchProfiles,
    revokeSessionsForAllUsers,
    getFilteredUsersStats,
} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getTeamsList} from 'mattermost-redux/selectors/entities/teams';
import {getFilteredUsersStats as selectFilteredUserStats, getUsers} from 'mattermost-redux/selectors/entities/users';

import {loadProfilesAndTeamMembers, loadProfilesWithoutTeam} from 'actions/user_actions';
import {setSystemUsersSearch} from 'actions/views/search';

import {SearchUserTeamFilter} from 'utils/constants';

import SystemUsers from './system_users';

import type {StatusOK} from '@mattermost/types/client4';
import type {ServerError} from '@mattermost/types/errors';
import type {GetFilteredUsersStatsOpts, UsersStats} from '@mattermost/types/users';
import type {Action, ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    const siteName = config.SiteName;
    const mfaEnabled = config.EnableMultifactorAuthentication === 'true';
    const enableUserAccessTokens = config.EnableUserAccessTokens === 'true';
    const experimentalEnableAuthenticationTransfer = config.ExperimentalEnableAuthenticationTransfer === 'true';

    const search = state.views.search.systemUsersSearch;
    let totalUsers = 0;
    let searchTerm = '';
    let teamId = '';
    let filter = '';
    if (search) {
        searchTerm = search.term || '';
        teamId = search.team || '';
        filter = search.filter || '';

        if (!teamId || teamId === SearchUserTeamFilter.ALL_USERS) {
            totalUsers = selectFilteredUserStats(state)?.total_users_count || 0;
        } else if (teamId === SearchUserTeamFilter.NO_TEAM) {
            totalUsers = 0;
        } else {
            const stats = state.entities.teams.stats[teamId] || {total_member_count: 0};
            totalUsers = stats.total_member_count;
        }
    }

    return {
        teams: getTeamsList(state),
        siteName,
        mfaEnabled,
        totalUsers,
        searchTerm,
        teamId,
        filter,
        enableUserAccessTokens,
        users: getUsers(state),
        experimentalEnableAuthenticationTransfer,
    };
}

type StatusOKFunc = () => Promise<StatusOK>;
type PromiseStatusFunc = () => Promise<{status: string}>;
type ActionCreatorTypes = Action | PromiseStatusFunc | StatusOKFunc;

type Actions = {
    getTeams: (startInde: number, endIndex: number) => void;
    getTeamStats: (teamId: string) => ActionFunc<any, any>;
    getUser: (id: string) => ActionFunc<any, any>;
    getUserAccessToken: (tokenId: string) => Promise<any> | ActionFunc;
    loadProfilesAndTeamMembers: (page: number, maxItemsPerPage: number, teamId: string, options: Record<string, string | boolean>) => void;
    loadProfilesWithoutTeam: (page: number, maxItemsPerPage: number, options: Record<string, string | boolean>) => void;
    getProfiles: (page: number, maxItemsPerPage: number, options: Record<string, string | boolean>) => void;
    setSystemUsersSearch: (searchTerm: string, teamId: string, filter: string) => void;
    searchProfiles: (term: string, options?: any) => Promise<any> | ActionFunc;
    revokeSessionsForAllUsers: () => any;
    logError: (error: {type: string; message: string}) => void;
    getFilteredUsersStats: (filters: GetFilteredUsersStatsOpts) => Promise<{ data?: UsersStats | undefined; error?: ServerError | undefined}>;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionCreatorTypes>, Actions>({
            getTeams,
            getTeamStats,
            getUser,
            getUserAccessToken,
            loadProfilesAndTeamMembers,
            setSystemUsersSearch,
            loadProfilesWithoutTeam,
            getProfiles,
            searchProfiles,
            revokeSessionsForAllUsers,
            logError,
            getFilteredUsersStats,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SystemUsers);
